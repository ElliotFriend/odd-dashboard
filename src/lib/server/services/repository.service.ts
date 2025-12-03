import { eq, and, sql, or, like } from 'drizzle-orm';
import { db } from '../db';
import { repositories } from '../db/schema';
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
 * Filter options for getAllRepositories
 */
export interface RepositoryFilterOptions {
    agencyId?: number;
    ecosystemId?: number;
    eventId?: number;
    isFork?: boolean;
    search?: string; // Search by full_name
}

/**
 * Create a new repository
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
 * Get a repository by ID
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
 * Get all repositories with optional filtering
 */
export async function getAllRepositories(options: RepositoryFilterOptions = {}) {
    const conditions = [];

    if (options.agencyId !== undefined) {
        conditions.push(eq(repositories.agencyId, options.agencyId));
    }

    if (options.isFork !== undefined) {
        conditions.push(eq(repositories.isFork, options.isFork));
    }

    if (options.search) {
        conditions.push(like(repositories.fullName, `%${options.search}%`));
    }

    // Note: ecosystemId and eventId filtering would require joins with junction tables
    // For now, we'll implement basic filtering. Full filtering can be added later.

    if (conditions.length > 0) {
        return await db
            .select()
            .from(repositories)
            .where(and(...conditions))
            .orderBy(repositories.fullName);
    }

    return await db.select().from(repositories).orderBy(repositories.fullName);
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
 * Create or update a repository from GitHub API data
 * This is useful when syncing repositories from GitHub
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
