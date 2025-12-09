import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { repositories, authors, commits } from '../db/schema';
import { getCommits, extractAuthorFromCommit } from '../github/fetchers';
import { getCommitsByShas } from './commit.service';
import { markRepositoryAsMissing } from './repository.service';
import { RepositoryNotFoundError } from '../github/errors';
import type { GitHubCommit } from '../github/types';

/**
 * Sync result statistics returned after syncing a repository
 * @interface SyncResult
 * @property {number} repositoryId - The database ID of the repository that was synced
 * @property {number} commitsProcessed - Total number of commits processed from GitHub
 * @property {number} commitsCreated - Number of new commits created in the database
 * @property {number} commitsSkippedBots - Number of bot commits that were skipped
 * @property {number} authorsCreated - Number of new authors created in the database
 * @property {string[]} errors - Array of error messages encountered during sync
 */
export interface SyncResult {
    repositoryId: number;
    commitsProcessed: number;
    commitsCreated: number;
    commitsSkippedBots: number;
    authorsCreated: number;
    errors: string[];
}

/**
 * Find or create an author in the database.
 * Uses github_id as primary identifier, falls back to email if no github_id.
 *
 * This function implements the author deduplication strategy:
 * 1. Try to find by github_id (if available)
 * 2. Try to find by email (case-insensitive) if no github_id
 * 3. Create new author if no match found
 *
 * Also handles updating username when it changes for existing authors.
 *
 * @param {Object} authorInfo - Author information extracted from commit
 * @param {string} authorInfo.name - Author's display name
 * @param {string} authorInfo.email - Author's email address
 * @param {number|null} authorInfo.githubId - GitHub user ID (null for email-only commits)
 * @param {string|null} authorInfo.username - GitHub username (null for email-only commits)
 * @returns {Promise<{id: number, wasCreated: boolean}>} Object with author ID and creation flag
 * @throws {Error} If database operation fails
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
 *
 * This function loads all commit SHAs from the parent repository for a given branch
 * and caches them in a Map to avoid repeated database queries during fork sync.
 *
 * @param {number} parentRepositoryId - Database ID of the parent repository
 * @param {string} branch - Branch name to get commits from
 * @param {Map<number, Set<string>>} cache - In-memory cache for parent commit SHAs
 * @returns {Promise<Set<string>>} Set of commit SHAs from the parent repository
 * @throws {Error} If database query fails
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
 * Sync commits for a repository from GitHub.
 *
 * This is the main sync function that:
 * 1. Fetches commits from GitHub API with pagination
 * 2. Creates or finds authors in the database (with deduplication)
 * 3. Stores commits in the database
 * 4. For forks, syncs parent repository first and attributes commits correctly
 * 5. Filters out bot commits automatically
 * 6. Updates last_synced_at timestamp
 *
 * Fork-aware commit attribution:
 * - When syncing a fork, parent repository is synced first
 * - Commits are compared by SHA between fork and parent
 * - Commits existing in parent → attributed to parent repository
 * - Commits unique to fork → attributed to fork repository
 * - Prevents duplicate commits across fork/parent pairs
 *
 * @param {number} repositoryId - The database ID of the repository to sync
 * @param {Object} [options={}] - Sync options
 * @param {boolean} [options.initialSync=false] - If true, fetch all commits; if false, fetch only since last_synced_at
 * @param {number} [options.batchSize=1000] - Number of commits to process per batch
 * @returns {Promise<SyncResult>} Sync result with detailed statistics
 * @throws {Error} If repository not found or sync fails
 *
 * @example
 * // Initial sync (fetch all commits)
 * const result = await syncRepositoryCommits(1, { initialSync: true });
 * console.log(`Created ${result.commitsCreated} commits, ${result.authorsCreated} authors`);
 *
 * @example
 * // Incremental sync (fetch commits since last sync)
 * const result = await syncRepositoryCommits(1);
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

    // If this is a fork with a parent in the database, sync the parent first
    // This ensures parent commits are in the database before fork attribution
    if (repository.isFork && repository.parentRepositoryId) {
        const [parentRepo] = await db
            .select()
            .from(repositories)
            .where(eq(repositories.id, repository.parentRepositoryId))
            .limit(1);

        if (parentRepo) {
            console.log(`Fork detected: ${repository.fullName} -> ${parentRepo.fullName}`);
            console.log(`Syncing parent repository first...`);

            try {
                // Sync parent with incremental sync (not initial sync)
                // This ensures parent has latest commits without refetching everything
                await syncRepositoryCommits(parentRepo.id, {
                    initialSync: false,
                    batchSize,
                });
                console.log(`Parent sync completed for ${parentRepo.fullName}`);
            } catch (error: any) {
                console.error(`Warning: Failed to sync parent repository: ${error.message}`);
                // Continue with fork sync even if parent sync fails
            }
        }
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
        commitsSkippedBots: 0,
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

                            // Skip bot commits (GitHub bots have [bot] suffix)
                            if (authorInfo.username && authorInfo.username.includes('[bot]')) {
                                result.commitsSkippedBots++;
                                continue;
                            }

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
