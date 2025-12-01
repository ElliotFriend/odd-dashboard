import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { agencies } from '../db/schema';
import {
    createAgencySchema,
    updateAgencySchema,
    type CreateAgencyInput,
    type UpdateAgencyInput,
} from '../db/validators';

/**
 * Create a new agency
 */
export async function createAgency(input: CreateAgencyInput) {
    // Validate input
    const validated = createAgencySchema.parse(input);

    try {
        const [agency] = await db
            .insert(agencies)
            .values({
                name: validated.name,
                description: validated.description ?? null,
            })
            .returning();

        return agency;
    } catch (error: any) {
        // Handle unique constraint violation (duplicate name)
        if (error.code === '23505') {
            throw new Error(`Agency with name "${validated.name}" already exists`);
        }
        throw error;
    }
}

/**
 * Get an agency by ID
 */
export async function getAgencyById(id: number) {
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, id)).limit(1);

    return agency || null;
}

/**
 * Get all agencies
 */
export async function getAllAgencies() {
    return await db.select().from(agencies).orderBy(agencies.name);
}

/**
 * Update an agency
 */
export async function updateAgency(id: number, input: UpdateAgencyInput) {
    // Validate input
    const validated = updateAgencySchema.parse(input);

    // Check if agency exists
    const existing = await getAgencyById(id);
    if (!existing) {
        throw new Error(`Agency with ID ${id} not found`);
    }

    // Build update object (only include defined fields)
    const updateData: {
        name?: string;
        description?: string | null;
        updatedAt?: any;
    } = {
        updatedAt: sql`NOW()`,
    };

    if (validated.name !== undefined) {
        updateData.name = validated.name;
    }

    if (validated.description !== undefined) {
        updateData.description = validated.description;
    }

    try {
        const [updated] = await db
            .update(agencies)
            .set(updateData)
            .where(eq(agencies.id, id))
            .returning();

        return updated;
    } catch (error: any) {
        // Handle unique constraint violation (duplicate name)
        if (error.code === '23505') {
            throw new Error(`Agency with name "${validated.name}" already exists`);
        }
        throw error;
    }
}

/**
 * Delete an agency
 * Note: CASCADE handling is done by the database (SET NULL on foreign keys)
 */
export async function deleteAgency(id: number) {
    // Check if agency exists
    const existing = await getAgencyById(id);
    if (!existing) {
        throw new Error(`Agency with ID ${id} not found`);
    }

    // Delete the agency (CASCADE is handled by database foreign key constraints)
    await db.delete(agencies).where(eq(agencies.id, id));

    return { success: true };
}

