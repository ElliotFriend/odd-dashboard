import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { repositories, authors, commits } from '../db/schema';
import { getCommits, extractAuthorFromCommit } from '../github/fetchers';
import { getCommitsByShas } from './commit.service';
import { markRepositoryAsMissing } from './repository.service';
import { RepositoryNotFoundError } from '../github/errors';
import type { GitHubCommit } from '../github/types';

/**
 * Sync result statistics
 */
export interface SyncResult {
    repositoryId: number;
    commitsProcessed: number;
    commitsCreated: number;
    authorsCreated: number;
    errors: string[];
}

/**
 * Find or create an author in the database.
 * Uses github_id as primary identifier, falls back to email if no github_id.
 *
 * @param authorInfo - Author information extracted from commit
 * @returns Object with author ID and whether the author was newly created
 */
async function findOrCreateAuthor(authorInfo: {
    name: string;
    email: string;
    githubId: number | null;
    username: string | null;
}): Promise<{ id: number; wasCreated: boolean }> {
    // First, try to find by github_id (if available)
    if (authorInfo.githubId !== null) {
        const existingByGithubId = await db
            .select()
            .from(authors)
            .where(eq(authors.githubId, authorInfo.githubId))
            .limit(1);

        if (existingByGithubId.length > 0) {
            // Update username if it has changed
            if (authorInfo.username && existingByGithubId[0].username !== authorInfo.username) {
                await db
                    .update(authors)
                    .set({
                        username: authorInfo.username,
                        updatedAt: sql`NOW()`,
                    })
                    .where(eq(authors.id, existingByGithubId[0].id));
            }
            return { id: existingByGithubId[0].id, wasCreated: false };
        }
    }

    // If no github_id or not found, try to find by email (case-insensitive)
    if (authorInfo.email) {
        const existingByEmail = await db
            .select()
            .from(authors)
            .where(sql`LOWER(${authors.email}) = LOWER(${authorInfo.email})`)
            .limit(1);

        if (existingByEmail.length > 0) {
            // Update github_id and username if they're now available
            if (authorInfo.githubId !== null && existingByEmail[0].githubId === null) {
                await db
                    .update(authors)
                    .set({
                        githubId: authorInfo.githubId,
                        username: authorInfo.username,
                        updatedAt: sql`NOW()`,
                    })
                    .where(eq(authors.id, existingByEmail[0].id));
            }
            return { id: existingByEmail[0].id, wasCreated: false };
        }
    }

    // Create new author
    const [newAuthor] = await db
        .insert(authors)
        .values({
            githubId: authorInfo.githubId,
            username: authorInfo.username,
            name: authorInfo.name,
            email: authorInfo.email,
        })
        .returning({ id: authors.id });

    return { id: newAuthor.id, wasCreated: true };
}

/**
 * Get parent commit SHAs for fork comparison.
 * Caches results in memory to avoid repeated database queries.
 */
async function getParentCommitShas(
    parentRepositoryId: number,
    branch: string,
    cache: Map<number, Set<string>>,
): Promise<Set<string>> {
    // Check cache first
    if (cache.has(parentRepositoryId)) {
        return cache.get(parentRepositoryId)!;
    }

    // Fetch all commit SHAs from parent repository for the given branch
    const parentCommits = await db
        .select({ sha: commits.sha })
        .from(commits)
        .where(and(eq(commits.repositoryId, parentRepositoryId), eq(commits.branch, branch)));

    const shaSet = new Set(parentCommits.map((c) => c.sha));
    cache.set(parentRepositoryId, shaSet);

    return shaSet;
}

/**
 * Sync commits for a repository.
 * Fetches commits from GitHub and stores them in the database.
 * For forks, compares commits with parent repository to attribute correctly.
 *
 * @param repositoryId - The database ID of the repository to sync
 * @param options - Sync options
 * @returns Sync result with statistics
 */
export async function syncRepositoryCommits(
    repositoryId: number,
    options: {
        initialSync?: boolean; // If true, fetch all commits; if false, only fetch since last_synced_at
        batchSize?: number; // Number of commits to process per batch (default: 1000)
    } = {},
): Promise<SyncResult> {
    const { initialSync = false, batchSize = 1000 } = options;

    // Get repository from database
    const [repository] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, repositoryId))
        .limit(1);

    if (!repository) {
        throw new Error(`Repository with ID ${repositoryId} not found`);
    }

    // Parse owner and repo from full_name
    const [owner, repo] = repository.fullName.split('/');
    if (!owner || !repo) {
        throw new Error(`Invalid repository full_name: ${repository.fullName}`);
    }

    const result: SyncResult = {
        repositoryId,
        commitsProcessed: 0,
        commitsCreated: 0,
        authorsCreated: 0,
        errors: [],
    };

    // Fork-aware commit attribution
    let parentCommitShas: Set<string> | null = null;
    const parentCommitCache = new Map<number, Set<string>>();

    // If this is a fork and parent exists in database, load parent commit SHAs
    if (repository.isFork && repository.parentRepositoryId) {
        try {
            parentCommitShas = await getParentCommitShas(
                repository.parentRepositoryId,
                repository.defaultBranch,
                parentCommitCache,
            );
        } catch (error: any) {
            result.errors.push(
                `Warning: Could not load parent commits for fork comparison: ${error.message}`,
            );
            // Continue with sync even if parent commit loading fails
        }
    }

    try {
        // Determine the 'since' parameter for incremental sync
        let since: string | undefined;
        if (!initialSync && repository.lastSyncedAt) {
            // Fetch commits since last sync (ISO 8601 format)
            since = repository.lastSyncedAt.toISOString();
        }

        // Fetch commits from GitHub with pagination
        let page = 1;
        let hasMore = true;
        const perPage = 100; // GitHub API max is 100 per page

        while (hasMore) {
            try {
                const githubCommits = await getCommits(
                    owner,
                    repo,
                    repository.defaultBranch,
                    since,
                    page,
                    perPage,
                );

                if (githubCommits.length === 0) {
                    hasMore = false;
                    break;
                }

                // Process commits in batches
                for (let i = 0; i < githubCommits.length; i += batchSize) {
                    const batch = githubCommits.slice(i, i + batchSize);

                    // For fork-aware attribution, collect all SHAs in this batch first
                    // Then do a batch lookup to see which exist in parent
                    let batchParentShas: Set<string> | null = null;
                    if (parentCommitShas && repository.isFork && repository.parentRepositoryId) {
                        // For forks, we already have the parent commit SHAs cached
                        batchParentShas = parentCommitShas;
                    }

                    for (const commit of batch) {
                        try {
                            result.commitsProcessed++;

                            // Extract author information
                            const authorInfo = extractAuthorFromCommit(commit);

                            // Find or create author
                            const { id: authorId, wasCreated } =
                                await findOrCreateAuthor(authorInfo);
                            if (wasCreated) {
                                result.authorsCreated++;
                            }

                            // Extract commit date (prefer author date, fallback to committer date)
                            const commitDateStr =
                                commit.commit.author?.date || commit.commit.committer?.date;
                            if (!commitDateStr) {
                                throw new Error(`No commit date found for commit ${commit.sha}`);
                            }
                            const commitDate = new Date(commitDateStr);

                            // Fork-aware commit attribution
                            // If this is a fork and commit exists in parent, attribute to parent
                            // Otherwise, attribute to the fork repository
                            let targetRepositoryId = repository.id;

                            if (
                                repository.isFork &&
                                repository.parentRepositoryId &&
                                batchParentShas &&
                                batchParentShas.has(commit.sha)
                            ) {
                                // Commit exists in parent repository, attribute to parent
                                targetRepositoryId = repository.parentRepositoryId;
                            }

                            // Create commit (handle unique constraint violation)
                            try {
                                await db.insert(commits).values({
                                    repositoryId: targetRepositoryId,
                                    authorId,
                                    sha: commit.sha,
                                    commitDate,
                                    branch: repository.defaultBranch,
                                });
                                result.commitsCreated++;
                            } catch (error: any) {
                                // Ignore unique constraint violations (commit already exists)
                                if (error.code === '23505') {
                                    // PostgreSQL unique violation
                                    // Commit already exists, skip it
                                } else {
                                    throw error;
                                }
                            }
                        } catch (error: any) {
                            result.errors.push(
                                `Error processing commit ${commit.sha}: ${error.message}`,
                            );
                        }
                    }
                }

                // If we got fewer commits than requested, we've reached the end
                if (githubCommits.length < perPage) {
                    hasMore = false;
                } else {
                    page++;
                }
            } catch (error: any) {
                // Check if repository is missing (deleted, private, or inaccessible)
                if (error instanceof RepositoryNotFoundError) {
                    result.errors.push(
                        `Repository not found: ${error.message}. Marking as missing.`,
                    );
                    await markRepositoryAsMissing(repositoryId);
                    hasMore = false;
                    break;
                }
                result.errors.push(`Error fetching commits (page ${page}): ${error.message}`);
                hasMore = false;
            }
        }

        // Update last_synced_at
        await db
            .update(repositories)
            .set({
                lastSyncedAt: sql`NOW()`,
                updatedAt: sql`NOW()`,
            })
            .where(eq(repositories.id, repositoryId));
    } catch (error: any) {
        result.errors.push(`Sync failed: ${error.message}`);
        throw error;
    }

    return result;
}
