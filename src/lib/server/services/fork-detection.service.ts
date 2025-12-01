import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { repositories } from '../db/schema';
import type { GitHubRepository } from '../github/types';

/**
 * Extract fork information from a GitHub repository response.
 * 
 * @param githubRepo - The GitHub repository object from the API
 * @returns Fork information including isFork flag and parent full_name
 */
export function extractForkInfo(githubRepo: GitHubRepository): {
    isFork: boolean;
    parentFullName: string | null;
} {
    const isFork = githubRepo.fork || false;
    const parentFullName = githubRepo.parent?.full_name || null;

    return {
        isFork,
        parentFullName,
    };
}

/**
 * Find a repository in the database by its full_name.
 * 
 * @param fullName - The repository full_name (e.g., "owner/repo")
 * @returns The repository ID if found, null otherwise
 */
async function findRepositoryByFullName(fullName: string): Promise<number | null> {
    const [repo] = await db
        .select({ id: repositories.id })
        .from(repositories)
        .where(eq(repositories.fullName, fullName))
        .limit(1);

    return repo?.id || null;
}

/**
 * Link a fork repository to its parent repository if the parent exists in the database.
 * Updates the repository's parent_repository_id field.
 * 
 * @param repositoryId - The database ID of the fork repository
 * @param parentFullName - The full_name of the parent repository (e.g., "owner/parent-repo")
 * @returns The parent repository ID if linked, null if parent not found
 */
export async function linkForkToParent(
    repositoryId: number,
    parentFullName: string | null
): Promise<number | null> {
    if (!parentFullName) {
        // No parent to link
        return null;
    }

    // Find parent repository in database
    const parentId = await findRepositoryByFullName(parentFullName);

    if (parentId) {
        // Update the fork repository with parent_repository_id
        await db
            .update(repositories)
            .set({
                parentRepositoryId: parentId,
                updatedAt: sql`NOW()`,
            })
            .where(eq(repositories.id, repositoryId));

        return parentId;
    }

    // Parent not found in database
    return null;
}

/**
 * Detect fork status and link to parent repository if it exists.
 * This function extracts fork information from a GitHub repository response,
 * updates the repository's is_fork and parent_full_name fields, and links
 * to the parent repository if it exists in the database.
 * 
 * @param repositoryId - The database ID of the repository to update
 * @param githubRepo - The GitHub repository object from the API
 * @returns Object with fork detection results
 */
export async function detectAndLinkFork(
    repositoryId: number,
    githubRepo: GitHubRepository
): Promise<{
    isFork: boolean;
    parentFullName: string | null;
    parentRepositoryId: number | null;
    parentLinked: boolean;
}> {
    // Extract fork information from GitHub API response
    const forkInfo = extractForkInfo(githubRepo);

    // Update repository with fork information
    await db
        .update(repositories)
        .set({
            isFork: forkInfo.isFork,
            parentFullName: forkInfo.parentFullName,
            updatedAt: sql`NOW()`,
        })
        .where(eq(repositories.id, repositoryId));

    // If it's a fork, try to link to parent repository
    let parentRepositoryId: number | null = null;
    let parentLinked = false;

    if (forkInfo.isFork && forkInfo.parentFullName) {
        parentRepositoryId = await linkForkToParent(repositoryId, forkInfo.parentFullName);
        parentLinked = parentRepositoryId !== null;
    }

    return {
        isFork: forkInfo.isFork,
        parentFullName: forkInfo.parentFullName,
        parentRepositoryId,
        parentLinked,
    };
}

