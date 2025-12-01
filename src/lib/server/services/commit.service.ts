import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db';
import { commits } from '../db/schema';
import {
    createCommitSchema,
    bulkCreateCommitsSchema,
    updateCommitSchema,
    type CreateCommitInput,
    type BulkCreateCommitsInput,
    type UpdateCommitInput,
} from '../db/validators';

/**
 * Filter options for getCommitsByRepository and getCommitsByAuthor
 */
export interface CommitFilterOptions {
    startDate?: Date;
    endDate?: Date;
    branch?: string;
}

/**
 * Create a new commit
 */
export async function createCommit(input: CreateCommitInput) {
    // Validate input
    const validated = createCommitSchema.parse(input);

    try {
        const [commit] = await db
            .insert(commits)
            .values({
                repositoryId: validated.repositoryId,
                authorId: validated.authorId,
                sha: validated.sha,
                commitDate: validated.commitDate,
                branch: validated.branch,
            })
            .returning();

        return commit;
    } catch (error: any) {
        // Handle unique constraint violations (same SHA in same repository)
        if (error.code === '23505') {
            throw new Error(
                `Commit with SHA ${validated.sha} already exists in repository ${validated.repositoryId}`
            );
        }
        throw error;
    }
}

/**
 * Bulk insert commits for batch operations
 * Skips duplicates (commits with same repository_id and sha)
 */
export async function bulkInsertCommits(input: BulkCreateCommitsInput) {
    // Validate input
    const validated = bulkCreateCommitsSchema.parse(input);

    if (validated.length === 0) {
        return { inserted: 0, skipped: 0 };
    }

    let inserted = 0;
    let skipped = 0;

    // Insert commits one by one to handle duplicates gracefully
    // For better performance with large batches, we could use ON CONFLICT DO NOTHING
    // but that requires knowing the constraint name
    for (const commitData of validated) {
        try {
            await db.insert(commits).values({
                repositoryId: commitData.repositoryId,
                authorId: commitData.authorId,
                sha: commitData.sha,
                commitDate: commitData.commitDate,
                branch: commitData.branch,
            });
            inserted++;
        } catch (error: any) {
            // Skip duplicates
            if (error.code === '23505') {
                skipped++;
            } else {
                throw error;
            }
        }
    }

    return { inserted, skipped };
}

/**
 * Get a commit by ID
 */
export async function getCommitById(id: number) {
    const [commit] = await db.select().from(commits).where(eq(commits.id, id)).limit(1);

    return commit || null;
}

/**
 * Get commits by repository with optional filtering
 */
export async function getCommitsByRepository(
    repositoryId: number,
    options: CommitFilterOptions = {}
) {
    const conditions = [eq(commits.repositoryId, repositoryId)];

    if (options.startDate) {
        conditions.push(gte(commits.commitDate, options.startDate));
    }

    if (options.endDate) {
        conditions.push(lte(commits.commitDate, options.endDate));
    }

    if (options.branch) {
        conditions.push(eq(commits.branch, options.branch));
    }

    return await db
        .select()
        .from(commits)
        .where(and(...conditions))
        .orderBy(sql`${commits.commitDate} DESC`);
}

/**
 * Get commits by author with optional filtering
 */
export async function getCommitsByAuthor(authorId: number, options: CommitFilterOptions = {}) {
    const conditions = [eq(commits.authorId, authorId)];

    if (options.startDate) {
        conditions.push(gte(commits.commitDate, options.startDate));
    }

    if (options.endDate) {
        conditions.push(lte(commits.commitDate, options.endDate));
    }

    if (options.branch) {
        conditions.push(eq(commits.branch, options.branch));
    }

    return await db
        .select()
        .from(commits)
        .where(and(...conditions))
        .orderBy(sql`${commits.commitDate} DESC`);
}

/**
 * Get commits by SHA (for fork comparison)
 * Returns all commits with the given SHA across all repositories
 */
export async function getCommitsBySha(sha: string) {
    return await db
        .select()
        .from(commits)
        .where(eq(commits.sha, sha))
        .orderBy(sql`${commits.commitDate} DESC`);
}

/**
 * Get commits by SHA for a specific repository
 */
export async function getCommitByRepositoryAndSha(repositoryId: number, sha: string) {
    const [commit] = await db
        .select()
        .from(commits)
        .where(and(eq(commits.repositoryId, repositoryId), eq(commits.sha, sha)))
        .limit(1);

    return commit || null;
}

/**
 * Get commits by multiple SHAs (for batch fork comparison)
 * Returns commits matching any of the provided SHAs
 */
export async function getCommitsByShas(shas: string[]) {
    if (shas.length === 0) {
        return [];
    }

    return await db
        .select()
        .from(commits)
        .where(inArray(commits.sha, shas))
        .orderBy(sql`${commits.commitDate} DESC`);
}

/**
 * Update a commit
 */
export async function updateCommit(id: number, input: UpdateCommitInput) {
    // Validate input
    const validated = updateCommitSchema.parse(input);

    // Check if commit exists
    const existing = await getCommitById(id);
    if (!existing) {
        throw new Error(`Commit with ID ${id} not found`);
    }

    // Build update object (only include defined fields)
    const updateData: {
        repositoryId?: number;
        authorId?: number;
        sha?: string;
        commitDate?: Date;
        branch?: string;
    } = {};

    if (validated.repositoryId !== undefined) {
        updateData.repositoryId = validated.repositoryId;
    }

    if (validated.authorId !== undefined) {
        updateData.authorId = validated.authorId;
    }

    if (validated.sha !== undefined) {
        updateData.sha = validated.sha;
    }

    if (validated.commitDate !== undefined) {
        updateData.commitDate = validated.commitDate;
    }

    if (validated.branch !== undefined) {
        updateData.branch = validated.branch;
    }

    try {
        const [updated] = await db
            .update(commits)
            .set(updateData)
            .where(eq(commits.id, id))
            .returning();

        return updated;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            throw new Error(
                `Commit with SHA ${validated.sha} already exists in repository ${validated.repositoryId}`
            );
        }
        throw error;
    }
}

/**
 * Delete a commit
 */
export async function deleteCommit(id: number) {
    // Check if commit exists
    const existing = await getCommitById(id);
    if (!existing) {
        throw new Error(`Commit with ID ${id} not found`);
    }

    await db.delete(commits).where(eq(commits.id, id));

    return { success: true };
}

