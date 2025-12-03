import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { ecosystems } from '../db/schema';
import {
    createEcosystemSchema,
    updateEcosystemSchema,
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
