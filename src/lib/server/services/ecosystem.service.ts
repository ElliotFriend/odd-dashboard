import { eq, sql, and } from 'drizzle-orm';
import { db } from '../db';
import { ecosystems, repositoryEcosystems, repositories } from '../db/schema';
import {
    createEcosystemSchema,
    updateEcosystemSchema,
    associateRepositoryWithEcosystemSchema,
    type CreateEcosystemInput,
    type UpdateEcosystemInput,
} from '../db/validators';

/**
 * Check if setting a parentId would create a cycle in the ecosystem hierarchy.
 * Traverses up the parent chain to ensure the new parent is not a descendant.
 */
async function wouldCreateCycle(ecosystemId: number, newParentId: number | null): Promise<boolean> {
    if (newParentId === null) {
        // Setting parent to null never creates a cycle
        return false;
    }

    // If the new parent is the same as the ecosystem itself, that's a cycle
    if (newParentId === ecosystemId) {
        return true;
    }

    // Traverse up the parent chain from the new parent
    // If we encounter the ecosystemId, it means the new parent is a descendant, creating a cycle
    let currentId: number | null = newParentId;
    const visited = new Set<number>();

    while (currentId !== null) {
        // Check for infinite loop (shouldn't happen, but safety check)
        if (visited.has(currentId)) {
            break;
        }
        visited.add(currentId);

        // If we find the ecosystemId in the chain, it's a cycle
        if (currentId === ecosystemId) {
            return true;
        }

        // Get the parent of the current ecosystem
        const [current] = await db
            .select({ parentId: ecosystems.parentId })
            .from(ecosystems)
            .where(eq(ecosystems.id, currentId))
            .limit(1);

        if (!current) {
            break;
        }

        currentId = current.parentId;
    }

    return false;
}

/**
 * Get all child ecosystems (recursive)
 */
async function getChildEcosystems(ecosystemId: number): Promise<number[]> {
    const children: number[] = [];
    const directChildren = await db
        .select({ id: ecosystems.id })
        .from(ecosystems)
        .where(eq(ecosystems.parentId, ecosystemId));

    for (const child of directChildren) {
        children.push(child.id);
        // Recursively get grandchildren
        const grandchildren = await getChildEcosystems(child.id);
        children.push(...grandchildren);
    }

    return children;
}

/**
 * Create a new ecosystem
 */
export async function createEcosystem(input: CreateEcosystemInput) {
    // Validate input
    const validated = createEcosystemSchema.parse(input);

    // Check for cycle if parentId is provided
    if (validated.parentId !== null && validated.parentId !== undefined) {
        // We can't check for cycle on create since the ecosystem doesn't exist yet
        // But we can check if the parent exists
        const parent = await getEcosystemById(validated.parentId);
        if (!parent) {
            throw new Error(`Parent ecosystem with ID ${validated.parentId} not found`);
        }
    }

    try {
        const [ecosystem] = await db
            .insert(ecosystems)
            .values({
                name: validated.name,
                parentId: validated.parentId ?? null,
            })
            .returning();

        return ecosystem;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            throw new Error(`Ecosystem with name "${validated.name}" already exists`);
        }
        throw error;
    }
}

/**
 * Get an ecosystem by ID
 */
export async function getEcosystemById(id: number) {
    const [ecosystem] = await db.select().from(ecosystems).where(eq(ecosystems.id, id)).limit(1);

    return ecosystem || null;
}

/**
 * Get an ecosystem by name
 */
export async function getEcosystemByName(name: string) {
    const [ecosystem] = await db.select().from(ecosystems).where(eq(ecosystems.name, name)).limit(1);

    return ecosystem || null;
}

/**
 * Get all ecosystems with hierarchy information
 * Returns ecosystems ordered by name, with parent-child relationships preserved
 */
export async function getAllEcosystems() {
    return await db.select().from(ecosystems).orderBy(ecosystems.name);
}

/**
 * Get child ecosystems for a given ecosystem
 */
export async function getChildren(ecosystemId: number) {
    const childIds = await getChildEcosystems(ecosystemId);
    if (childIds.length === 0) {
        return [];
    }

    return await db
        .select()
        .from(ecosystems)
        .where(sql`${ecosystems.id} = ANY(${childIds})`)
        .orderBy(ecosystems.name);
}

/**
 * Get ancestor ecosystems (all parents up the chain)
 */
export async function getAncestors(ecosystemId: number) {
    const ancestors: any[] = [];
    let currentId: number | null = ecosystemId;
    const visited = new Set<number>();

    while (currentId !== null) {
        const [current] = await db
            .select()
            .from(ecosystems)
            .where(eq(ecosystems.id, currentId))
            .limit(1);

        if (!current || !current.parentId) {
            break;
        }

        // Safety check for infinite loops
        if (visited.has(current.parentId)) {
            break;
        }
        visited.add(current.parentId);

        const [parent] = await db
            .select()
            .from(ecosystems)
            .where(eq(ecosystems.id, current.parentId))
            .limit(1);

        if (parent) {
            ancestors.push(parent);
            currentId = parent.id;
        } else {
            break;
        }
    }

    return ancestors;
}

/**
 * Update an ecosystem
 */
export async function updateEcosystem(id: number, input: UpdateEcosystemInput) {
    // Validate input
    const validated = updateEcosystemSchema.parse(input);

    // Check if ecosystem exists
    const existing = await getEcosystemById(id);
    if (!existing) {
        throw new Error(`Ecosystem with ID ${id} not found`);
    }

    // Check for cycle if parentId is being updated
    if (validated.parentId !== undefined) {
        const wouldCycle = await wouldCreateCycle(id, validated.parentId ?? null);
        if (wouldCycle) {
            throw new Error(
                'Cannot set parent: this would create a circular reference in the ecosystem hierarchy',
            );
        }

        // If parentId is being set, verify the parent exists
        if (validated.parentId !== null) {
            const parent = await getEcosystemById(validated.parentId);
            if (!parent) {
                throw new Error(`Parent ecosystem with ID ${validated.parentId} not found`);
            }
        }
    }

    // Build update object (only include defined fields)
    const updateData: {
        name?: string;
        parentId?: number | null;
        updatedAt?: any;
    } = {
        updatedAt: sql`NOW()`,
    };

    if (validated.name !== undefined) {
        updateData.name = validated.name;
    }

    if (validated.parentId !== undefined) {
        updateData.parentId = validated.parentId;
    }

    try {
        const [updated] = await db
            .update(ecosystems)
            .set(updateData)
            .where(eq(ecosystems.id, id))
            .returning();

        return updated;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            throw new Error(`Ecosystem with name "${validated.name}" already exists`);
        }
        throw error;
    }
}

/**
 * Delete an ecosystem
 * Note: CASCADE handling is done by the database (SET NULL on repository_ecosystems.ecosystem_id)
 */
export async function deleteEcosystem(id: number) {
    // Check if ecosystem exists
    const existing = await getEcosystemById(id);
    if (!existing) {
        throw new Error(`Ecosystem with ID ${id} not found`);
    }

    // Delete the ecosystem (SET NULL is handled by database foreign key constraints)
    await db.delete(ecosystems).where(eq(ecosystems.id, id));

    return { success: true };
}

/**
 * Associate a repository with an ecosystem
 */
export async function associateRepositoryWithEcosystem(
    repositoryId: number,
    ecosystemId: number,
) {
    // Validate input
    const validated = associateRepositoryWithEcosystemSchema.parse({ repositoryId, ecosystemId });

    // Check if repository exists
    const [repository] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, validated.repositoryId))
        .limit(1);

    if (!repository) {
        throw new Error(`Repository with ID ${validated.repositoryId} not found`);
    }

    // Check if ecosystem exists
    const ecosystem = await getEcosystemById(validated.ecosystemId);
    if (!ecosystem) {
        throw new Error(`Ecosystem with ID ${validated.ecosystemId} not found`);
    }

    try {
        // Insert association (ignore if already exists)
        await db.insert(repositoryEcosystems).values({
            repositoryId: validated.repositoryId,
            ecosystemId: validated.ecosystemId,
        });

        return { success: true, alreadyAssociated: false };
    } catch (error: any) {
        // Handle duplicate key violations gracefully
        if (error.code === '23505') {
            // Already associated, return success
            return { success: true, alreadyAssociated: true };
        }
        throw error;
    }
}

/**
 * Remove repository from ecosystem
 */
export async function removeRepositoryFromEcosystem(repositoryId: number, ecosystemId: number) {
    await db
        .delete(repositoryEcosystems)
        .where(
            and(
                eq(repositoryEcosystems.repositoryId, repositoryId),
                eq(repositoryEcosystems.ecosystemId, ecosystemId),
            ),
        );

    return { success: true };
}

/**
 * Get all repositories for an ecosystem
 */
export async function getRepositoriesForEcosystem(ecosystemId: number) {
    // Check if ecosystem exists
    const ecosystem = await getEcosystemById(ecosystemId);
    if (!ecosystem) {
        throw new Error(`Ecosystem with ID ${ecosystemId} not found`);
    }

    const results = await db
        .select({
            id: repositories.id,
            githubId: repositories.githubId,
            fullName: repositories.fullName,
            agencyId: repositories.agencyId,
            isFork: repositories.isFork,
            parentRepositoryId: repositories.parentRepositoryId,
            parentFullName: repositories.parentFullName,
            defaultBranch: repositories.defaultBranch,
            createdAt: repositories.createdAt,
            updatedAt: repositories.updatedAt,
            lastSyncedAt: repositories.lastSyncedAt,
        })
        .from(repositories)
        .innerJoin(repositoryEcosystems, eq(repositories.id, repositoryEcosystems.repositoryId))
        .where(eq(repositoryEcosystems.ecosystemId, ecosystemId))
        .orderBy(repositories.fullName);

    return results;
}

/**
 * Get all ecosystems for a repository
 */
export async function getEcosystemsForRepository(repositoryId: number) {
    const results = await db
        .select({
            id: ecosystems.id,
            name: ecosystems.name,
            parentId: ecosystems.parentId,
            createdAt: ecosystems.createdAt,
            updatedAt: ecosystems.updatedAt,
        })
        .from(ecosystems)
        .innerJoin(repositoryEcosystems, eq(ecosystems.id, repositoryEcosystems.ecosystemId))
        .where(eq(repositoryEcosystems.repositoryId, repositoryId))
        .orderBy(ecosystems.name);

    return results;
}
