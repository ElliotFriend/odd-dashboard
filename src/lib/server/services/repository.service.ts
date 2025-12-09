import { eq, and, sql, or, like, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import { repositories, commits, authors, repositoryEvents } from '../db/schema';
import {
    createRepositorySchema,
    updateRepositorySchema,
    type CreateRepositoryInput,
    type UpdateRepositoryInput,
} from '../db/validators';
import { getRepository } from '../github/fetchers';
import { detectAndLinkFork } from './fork-detection.service';
import { checkAndUpdateRepositoryName } from './repository-rename.service';
import type { GitHubRepository } from '../github/types';

/**
 * Filter options for getAllRepositories query
 * @interface RepositoryFilterOptions
 * @property {number} [agencyId] - Filter by agency ID
 * @property {number} [ecosystemId] - Filter by ecosystem ID
 * @property {number} [eventId] - Filter by event ID
 * @property {boolean} [excludeForks=false] - If true, exclude fork repositories
 * @property {string} [search] - Search term to filter by full_name (case-insensitive)
 * @property {'commits'|'contributors'|'lastCommitDate'|'fullName'} [sortBy] - Field to sort by
 * @property {'asc'|'desc'} [sortOrder] - Sort order
 */
export interface RepositoryFilterOptions {
    agencyId?: number;
    ecosystemId?: number;
    eventId?: number;
    excludeForks?: boolean; // If true, exclude forks (inverted from isFork)
    search?: string; // Search by full_name
    sortBy?: 'commits' | 'contributors' | 'lastCommitDate' | 'fullName';
    sortOrder?: 'asc' | 'desc';
}

/**
 * Create a new repository in the database.
 *
 * @param {CreateRepositoryInput} input - Repository data to create
 * @param {number} input.githubId - GitHub repository ID (required, unique)
 * @param {string} input.fullName - Repository full name "owner/repo" (required, unique)
 * @param {number} [input.agencyId] - Agency ID that sourced this repository
 * @param {boolean} [input.isFork=false] - Whether this repository is a fork
 * @param {number} [input.parentRepositoryId] - Parent repository ID if fork exists in DB
 * @param {string} [input.parentFullName] - Parent repository full name
 * @param {string} [input.defaultBranch='main'] - Default branch name
 * @returns {Promise<Repository>} Created repository
 * @throws {Error} If repository with same githubId or fullName already exists
 * @throws {Error} If validation fails
 *
 * @example
 * const repo = await createRepository({
 *   githubId: 123456789,
 *   fullName: 'stellar/stellar-core',
 *   agencyId: 1,
 *   defaultBranch: 'master'
 * });
 */
export async function createRepository(input: CreateRepositoryInput) {
    // Validate input
    const validated = createRepositorySchema.parse(input);

    try {
        const [repository] = await db
            .insert(repositories)
            .values({
                githubId: validated.githubId,
                fullName: validated.fullName,
                agencyId: validated.agencyId ?? null,
                isFork: validated.isFork ?? false,
                parentRepositoryId: validated.parentRepositoryId ?? null,
                parentFullName: validated.parentFullName ?? null,
                defaultBranch: validated.defaultBranch ?? 'main',
            })
            .returning();

        return repository;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            if (error.constraint?.includes('github_id')) {
                throw new Error(`Repository with GitHub ID ${validated.githubId} already exists`);
            }
            if (error.constraint?.includes('full_name')) {
                throw new Error(`Repository with full name "${validated.fullName}" already exists`);
            }
            throw new Error('Repository with this identifier already exists');
        }
        throw error;
    }
}

/**
 * Get a repository by its database ID.
 *
 * @param {number} id - Database ID of the repository
 * @returns {Promise<Repository|null>} Repository object or null if not found
 *
 * @example
 * const repo = await getRepositoryById(1);
 * if (repo) {
 *   console.log(repo.fullName);
 * }
 */
export async function getRepositoryById(id: number) {
    const [repository] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, id))
        .limit(1);

    return repository || null;
}

/**
 * Get a repository by GitHub ID
 */
export async function getRepositoryByGithubId(githubId: number) {
    const [repository] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.githubId, githubId))
        .limit(1);

    return repository || null;
}

/**
 * Get a repository by full name
 */
export async function getRepositoryByFullName(fullName: string) {
    const [repository] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.fullName, fullName))
        .limit(1);

    return repository || null;
}

/**
 * Get all repositories with optional filtering, statistics, and sorting.
 *
 * This function returns repositories with aggregated statistics including:
 * - Commit count
 * - Contributor count (distinct authors)
 * - Last commit date
 *
 * Uses efficient SQL with LEFT JOIN LATERAL for computing statistics in a single query.
 *
 * @param {RepositoryFilterOptions} [options={}] - Filter and sort options
 * @param {number} [options.agencyId] - Filter by agency ID
 * @param {number} [options.eventId] - Filter by event ID (joins through repository_events)
 * @param {boolean} [options.excludeForks=false] - If true, exclude fork repositories
 * @param {string} [options.search] - Search term for repository name (case-insensitive)
 * @param {string} [options.sortBy='fullName'] - Field to sort by
 * @param {string} [options.sortOrder='asc'] - Sort order
 * @returns {Promise<RepositoryWithStats[]>} Array of repositories with statistics
 *
 * @example
 * // Get non-fork repositories sorted by commits
 * const repos = await getAllRepositories({
 *   excludeForks: true,
 *   sortBy: 'commits',
 *   sortOrder: 'desc'
 * });
 *
 * @example
 * // Search for repositories by name
 * const repos = await getAllRepositories({
 *   search: 'stellar',
 *   agencyId: 1
 * });
 */
export async function getAllRepositories(options: RepositoryFilterOptions = {}) {
    const {
        agencyId,
        eventId,
        excludeForks = false,
        search,
        sortBy = 'fullName',
        sortOrder = 'asc',
    } = options;

    // Build WHERE conditions array for SQL
    const whereConditions: any[] = [];

    if (agencyId !== undefined) {
        whereConditions.push(sql`r.agency_id = ${agencyId}`);
    }

    if (excludeForks) {
        whereConditions.push(sql`r.is_fork = false`);
    }

    if (search) {
        whereConditions.push(sql`r.full_name ILIKE ${`%${search}%`}`);
    }

    if (eventId !== undefined) {
        whereConditions.push(sql`re.event_id = ${eventId}`);
    }

    // Build WHERE clause
    const whereClause = whereConditions.length > 0
        ? sql` WHERE ${sql.join(whereConditions, sql` AND `)}`
        : sql``;

    // Build ORDER BY clause
    let orderByClause;
    switch (sortBy) {
        case 'commits':
            orderByClause = sortOrder === 'asc'
                ? sql`commit_count ASC, r.full_name ASC`
                : sql`commit_count DESC, r.full_name ASC`;
            break;
        case 'contributors':
            orderByClause = sortOrder === 'asc'
                ? sql`contributor_count ASC, r.full_name ASC`
                : sql`contributor_count DESC, r.full_name ASC`;
            break;
        case 'lastCommitDate':
            orderByClause = sortOrder === 'asc'
                ? sql`last_commit_date ASC NULLS LAST, r.full_name ASC`
                : sql`last_commit_date DESC NULLS LAST, r.full_name ASC`;
            break;
        case 'fullName':
        default:
            orderByClause = sortOrder === 'asc'
                ? sql`r.full_name ASC`
                : sql`r.full_name DESC`;
            break;
    }

    // Build the query with statistics
    // For event filtering, we use INNER JOIN to only show repos associated with that event
    const eventJoin = eventId !== undefined
        ? sql`INNER JOIN repository_events re ON r.id = re.repository_id`
        : sql``;

    const query = sql`
        SELECT
            r.id,
            r.github_id,
            r.full_name,
            r.agency_id,
            r.is_fork,
            r.parent_repository_id,
            r.parent_full_name,
            r.default_branch,
            r.is_missing,
            r.created_at,
            r.updated_at,
            r.last_synced_at,
            COALESCE(stats.commit_count, 0) AS commit_count,
            COALESCE(stats.contributor_count, 0) AS contributor_count,
            stats.last_commit_date
        FROM repositories r
        ${eventJoin}
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*)::int AS commit_count,
                COUNT(DISTINCT c.author_id)::int AS contributor_count,
                MAX(c.commit_date) AS last_commit_date
            FROM commits c
            WHERE c.repository_id = r.id
        ) stats ON true
        ${whereClause}
        ORDER BY ${orderByClause}
    `;

    const result = await db.execute(query);

    // @ts-ignore - rows property exists on execute result
    const rows = result.rows || result;

    return rows.map((row: any) => ({
        id: row.id,
        githubId: Number(row.github_id),
        fullName: row.full_name,
        agencyId: row.agency_id,
        isFork: row.is_fork,
        parentRepositoryId: row.parent_repository_id,
        parentFullName: row.parent_full_name,
        defaultBranch: row.default_branch,
        isMissing: row.is_missing,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastSyncedAt: row.last_synced_at,
        commitCount: row.commit_count,
        contributorCount: row.contributor_count,
        lastCommitDate: row.last_commit_date,
    }));
}

/**
 * Update a repository
 */
export async function updateRepository(id: number, input: UpdateRepositoryInput) {
    // Validate input
    const validated = updateRepositorySchema.parse(input);

    // Check if repository exists
    const existing = await getRepositoryById(id);
    if (!existing) {
        throw new Error(`Repository with ID ${id} not found`);
    }

    // Build update object (only include defined fields)
    const updateData: {
        githubId?: number;
        fullName?: string;
        agencyId?: number | null;
        isFork?: boolean;
        parentRepositoryId?: number | null;
        parentFullName?: string | null;
        defaultBranch?: string;
        updatedAt?: any;
    } = {
        updatedAt: sql`NOW()`,
    };

    if (validated.githubId !== undefined) {
        updateData.githubId = validated.githubId;
    }

    if (validated.fullName !== undefined) {
        updateData.fullName = validated.fullName;
    }

    if (validated.agencyId !== undefined) {
        updateData.agencyId = validated.agencyId;
    }

    if (validated.isFork !== undefined) {
        updateData.isFork = validated.isFork;
    }

    if (validated.parentRepositoryId !== undefined) {
        updateData.parentRepositoryId = validated.parentRepositoryId;
    }

    if (validated.parentFullName !== undefined) {
        updateData.parentFullName = validated.parentFullName;
    }

    if (validated.defaultBranch !== undefined) {
        updateData.defaultBranch = validated.defaultBranch;
    }

    try {
        const [updated] = await db
            .update(repositories)
            .set(updateData)
            .where(eq(repositories.id, id))
            .returning();

        return updated;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            if (error.constraint?.includes('github_id')) {
                throw new Error(`Repository with GitHub ID ${validated.githubId} already exists`);
            }
            if (error.constraint?.includes('full_name')) {
                throw new Error(`Repository with full name "${validated.fullName}" already exists`);
            }
            throw new Error('Repository with this identifier already exists');
        }
        throw error;
    }
}

/**
 * Delete a repository
 * Note: CASCADE handling is done by the database (CASCADE delete on commits)
 */
export async function deleteRepository(id: number) {
    // Check if repository exists
    const existing = await getRepositoryById(id);
    if (!existing) {
        throw new Error(`Repository with ID ${id} not found`);
    }

    // Delete the repository (CASCADE is handled by database foreign key constraints)
    await db.delete(repositories).where(eq(repositories.id, id));

    return { success: true };
}

/**
 * Create or update a repository from GitHub API data.
 *
 * This is the main function for syncing repository metadata from GitHub.
 * It handles:
 * - Creating new repositories from GitHub data
 * - Updating existing repositories with latest GitHub data
 * - Fork detection and parent linking
 * - Repository rename detection
 *
 * The function is idempotent and can be safely called multiple times for the same repository.
 *
 * @param {GitHubRepository} githubRepo - Repository data from GitHub API
 * @param {Object} [options={}] - Configuration options
 * @param {number|null} [options.agencyId] - Agency ID to associate with repository
 * @param {boolean} [options.detectFork=true] - If true, detect and link fork relationships
 * @param {boolean} [options.detectRename=true] - If true, detect repository renames
 * @returns {Promise<{repository: Repository, created: boolean}>} Repository and creation flag
 * @throws {Error} If GitHub data is invalid or database operation fails
 *
 * @example
 * // Create or update repository from GitHub
 * const githubRepo = await getRepository('stellar', 'stellar-core');
 * const { repository, created } = await createOrUpdateRepositoryFromGitHub(githubRepo, {
 *   agencyId: 1,
 *   detectFork: true,
 *   detectRename: true
 * });
 * if (created) {
 *   console.log('Created new repository:', repository.fullName);
 * } else {
 *   console.log('Updated existing repository:', repository.fullName);
 * }
 */
export async function createOrUpdateRepositoryFromGitHub(
    githubRepo: GitHubRepository,
    options: {
        agencyId?: number | null;
        detectFork?: boolean;
        detectRename?: boolean;
    } = {},
): Promise<{ repository: any; created: boolean }> {
    const { agencyId, detectFork = true, detectRename = true } = options;

    // Check if repository already exists by GitHub ID
    const existing = await getRepositoryByGithubId(githubRepo.id);

    if (existing) {
        // Update existing repository
        const updateData: UpdateRepositoryInput = {
            fullName: githubRepo.full_name,
            defaultBranch: githubRepo.default_branch,
            agencyId: agencyId ?? existing.agencyId,
        };

        const updated = await updateRepository(existing.id, updateData);

        // Detect and link fork if enabled
        if (detectFork) {
            await detectAndLinkFork(updated.id, githubRepo);
        }

        // Detect rename if enabled
        if (detectRename && existing.fullName !== githubRepo.full_name) {
            await checkAndUpdateRepositoryName(updated.id, existing.fullName, githubRepo.id);
        }

        return { repository: updated, created: false };
    } else {
        // Create new repository
        const createData: CreateRepositoryInput = {
            githubId: githubRepo.id,
            fullName: githubRepo.full_name,
            defaultBranch: githubRepo.default_branch,
            agencyId: agencyId ?? null,
            isFork: githubRepo.fork || false,
            parentFullName: githubRepo.parent?.full_name || null,
        };

        const created = await createRepository(createData);

        // Detect and link fork if enabled
        if (detectFork) {
            await detectAndLinkFork(created.id, githubRepo);
        }

        return { repository: created, created: true };
    }
}

/**
 * Detect fork and update repository
 */
export async function detectForkForRepository(repositoryId: number, githubRepo: GitHubRepository) {
    return await detectAndLinkFork(repositoryId, githubRepo);
}

/**
 * Detect rename and update repository
 */
export async function detectRenameForRepository(repositoryId: number) {
    const repository = await getRepositoryById(repositoryId);
    if (!repository) {
        throw new Error(`Repository with ID ${repositoryId} not found`);
    }

    return await checkAndUpdateRepositoryName(
        repository.id,
        repository.fullName,
        repository.githubId,
    );
}

/**
 * Mark a repository as missing (soft delete).
 *
 * This is used when a repository becomes inaccessible on GitHub due to:
 * - Repository deletion
 * - Made private (token doesn't have access)
 * - Organization restrictions
 *
 * The repository is not deleted from the database, preserving all historical data.
 * The `is_missing` flag is set to true, and the repository can be restored if it
 * becomes accessible again.
 *
 * @param {number} repositoryId - Database ID of the repository
 * @returns {Promise<void>}
 * @throws {Error} If repository not found
 *
 * @example
 * // Mark repository as missing during sync
 * try {
 *   await syncRepositoryCommits(1);
 * } catch (error) {
 *   if (error instanceof RepositoryNotFoundError) {
 *     await markRepositoryAsMissing(1);
 *   }
 * }
 */
export async function markRepositoryAsMissing(repositoryId: number): Promise<void> {
    const repository = await getRepositoryById(repositoryId);
    if (!repository) {
        throw new Error(`Repository with ID ${repositoryId} not found`);
    }

    await db
        .update(repositories)
        .set({
            isMissing: true,
            updatedAt: sql`NOW()`,
        })
        .where(eq(repositories.id, repositoryId));
}

/**
 * Mark a repository as found (restore from missing state).
 * This is used when a previously missing repository becomes accessible again.
 */
export async function markRepositoryAsFound(repositoryId: number): Promise<void> {
    const repository = await getRepositoryById(repositoryId);
    if (!repository) {
        throw new Error(`Repository with ID ${repositoryId} not found`);
    }

    await db
        .update(repositories)
        .set({
            isMissing: false,
            updatedAt: sql`NOW()`,
        })
        .where(eq(repositories.id, repositoryId));
}
