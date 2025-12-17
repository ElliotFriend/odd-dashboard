import { eq, sql, and, like, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { authors, commits, repositories } from '../db/schema';
import {
    createAuthorSchema,
    updateAuthorSchema,
    type CreateAuthorInput,
    type UpdateAuthorInput,
} from '../db/validators';

/**
 * Filter options for getAllAuthors
 */
export interface AuthorFilterOptions {
    agencyId?: number;
    githubId?: number;
    email?: string;
    search?: string; // Search by name, username, or email
}

/**
 * Find or create an author with deduplication logic.
 * Uses github_id as primary identifier, falls back to email if no github_id.
 * This is the same logic used in sync.service.ts
 */
export async function findOrCreateAuthor(authorInfo: {
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
 * Create a new author
 */
export async function createAuthor(input: CreateAuthorInput) {
    // Validate input
    const validated = createAuthorSchema.parse(input);

    try {
        const [author] = await db
            .insert(authors)
            .values({
                githubId: validated.githubId ?? null,
                username: validated.username ?? null,
                name: validated.name ?? null,
                email: validated.email ?? null,
                agencyId: validated.agencyId ?? null,
            })
            .returning();

        return author;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            if (error.constraint?.includes('github_id')) {
                throw new Error(`Author with GitHub ID ${validated.githubId} already exists`);
            }
            throw new Error('Author with this identifier already exists');
        }
        throw error;
    }
}

/**
 * Get an author by ID
 */
export async function getAuthorById(id: number) {
    const [author] = await db.select().from(authors).where(eq(authors.id, id)).limit(1);

    return author || null;
}

/**
 * Get an author by GitHub ID
 */
export async function getAuthorByGithubId(githubId: number) {
    const [author] = await db.select().from(authors).where(eq(authors.githubId, githubId)).limit(1);

    return author || null;
}

/**
 * Get an author by email (case-insensitive)
 */
export async function getAuthorByEmail(email: string) {
    const [author] = await db
        .select()
        .from(authors)
        .where(sql`LOWER(${authors.email}) = LOWER(${email})`)
        .limit(1);

    return author || null;
}

/**
 * Get all authors with optional filtering
 */
export async function getAllAuthors(options: AuthorFilterOptions = {}) {
    const conditions = [];

    if (options.agencyId !== undefined) {
        conditions.push(eq(authors.agencyId, options.agencyId));
    }

    if (options.githubId !== undefined) {
        conditions.push(eq(authors.githubId, options.githubId));
    }

    if (options.email) {
        conditions.push(sql`LOWER(${authors.email}) = LOWER(${options.email})`);
    }

    if (options.search) {
        const searchPattern = `%${options.search}%`;
        conditions.push(
            sql`(
                ${authors.name} ILIKE ${searchPattern} OR
                ${authors.username} ILIKE ${searchPattern} OR
                ${authors.email} ILIKE ${searchPattern}
            )`,
        );
    }

    if (conditions.length > 0) {
        return await db
            .select()
            .from(authors)
            .where(and(...conditions))
            .orderBy(authors.name, authors.username);
    }

    return await db.select().from(authors).orderBy(authors.name, authors.username);
}

/**
 * Update an author
 */
export async function updateAuthor(id: number, input: UpdateAuthorInput) {
    // Validate input
    const validated = updateAuthorSchema.parse(input);

    // Check if author exists
    const existing = await getAuthorById(id);
    if (!existing) {
        throw new Error(`Author with ID ${id} not found`);
    }

    // Build update object (only include defined fields)
    const updateData: {
        githubId?: number | null;
        username?: string | null;
        name?: string | null;
        email?: string | null;
        agencyId?: number | null;
        updatedAt?: any;
    } = {
        updatedAt: sql`NOW()`,
    };

    if (validated.githubId !== undefined) {
        updateData.githubId = validated.githubId;
    }

    if (validated.username !== undefined) {
        updateData.username = validated.username;
    }

    if (validated.name !== undefined) {
        updateData.name = validated.name;
    }

    if (validated.email !== undefined) {
        updateData.email = validated.email;
    }

    if (validated.agencyId !== undefined) {
        updateData.agencyId = validated.agencyId;
    }

    try {
        const [updated] = await db
            .update(authors)
            .set(updateData)
            .where(eq(authors.id, id))
            .returning();

        return updated;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            if (error.constraint?.includes('github_id')) {
                throw new Error(`Author with GitHub ID ${validated.githubId} already exists`);
            }
            throw new Error('Author with this identifier already exists');
        }
        throw error;
    }
}

/**
 * Delete an author
 * Note: CASCADE handling is done by the database (SET NULL on commits.author_id)
 */
export async function deleteAuthor(id: number) {
    // Check if author exists
    const existing = await getAuthorById(id);
    if (!existing) {
        throw new Error(`Author with ID ${id} not found`);
    }

    // Delete the author (SET NULL is handled by database foreign key constraints)
    await db.delete(authors).where(eq(authors.id, id));

    return { success: true };
}

/**
 * Repository contribution for an author
 */
export interface AuthorRepositoryContribution {
    repositoryId: number;
    fullName: string;
    commitCount: number;
}

/**
 * Author details with statistics over a date range
 */
export interface AuthorDetails {
    author: {
        id: number;
        githubId: number | null;
        username: string | null;
        name: string | null;
        email: string | null;
        agencyId: number | null;
    };
    statistics: {
        totalCommits: number;
        totalRepositories: number;
        dateRange: {
            startDate: string;
            endDate: string;
        };
    };
    repositories: AuthorRepositoryContribution[];
}

/**
 * Get author details with statistics over a date range
 */
export async function getAuthorDetails(
    authorId: number,
    startDate: string,
    endDate: string
): Promise<AuthorDetails | null> {
    // Get author
    const author = await getAuthorById(authorId);
    if (!author) {
        return null;
    }

    // Get repositories the author has committed to with commit counts
    const repoContributionsQuery = sql`
        SELECT
            r.id as repository_id,
            r.full_name,
            COUNT(c.id)::int as commit_count
        FROM commits c
        INNER JOIN repositories r ON c.repository_id = r.id
        WHERE c.author_id = ${authorId}
          AND c.commit_date >= ${startDate}::timestamp
          AND c.commit_date <= ${endDate}::timestamp
        GROUP BY r.id, r.full_name
        ORDER BY commit_count DESC
    `;

    const repoContributionsResult = await db.execute(repoContributionsQuery);
    // @ts-ignore
    const repoContributionsRows = repoContributionsResult.rows || repoContributionsResult;

    // Get total stats
    const statsQuery = sql`
        SELECT
            COUNT(c.id)::int as total_commits,
            COUNT(DISTINCT c.repository_id)::int as total_repositories
        FROM commits c
        WHERE c.author_id = ${authorId}
          AND c.commit_date >= ${startDate}::timestamp
          AND c.commit_date <= ${endDate}::timestamp
    `;

    const statsResult = await db.execute(statsQuery);
    // @ts-ignore
    const statsRows = statsResult.rows || statsResult;
    const stats = statsRows[0];

    return {
        author,
        statistics: {
            totalCommits: stats?.total_commits || 0,
            totalRepositories: stats?.total_repositories || 0,
            dateRange: {
                startDate,
                endDate,
            },
        },
        repositories: repoContributionsRows.map((r: any) => ({
            repositoryId: r.repository_id,
            fullName: r.full_name,
            commitCount: r.commit_count,
        })),
    };
}
