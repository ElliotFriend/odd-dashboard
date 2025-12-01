import { eq, and, sql, like } from 'drizzle-orm';
import { db } from '../db';
import { events, authorEvents, repositoryEvents, authors, repositories } from '../db/schema';
import {
    createEventSchema,
    updateEventSchema,
    associateAuthorWithEventSchema,
    associateRepositoryWithEventSchema,
    type CreateEventInput,
    type UpdateEventInput,
    type AssociateAuthorWithEventInput,
    type AssociateRepositoryWithEventInput,
} from '../db/validators';

/**
 * Filter options for getAllEvents
 */
export interface EventFilterOptions {
    agencyId?: number;
    search?: string; // Search by name or description
}

/**
 * Create a new event
 */
export async function createEvent(input: CreateEventInput) {
    // Validate input
    const validated = createEventSchema.parse(input);

    try {
        const [event] = await db
            .insert(events)
            .values({
                name: validated.name,
                description: validated.description ?? null,
                startDate: validated.startDate
                    ? validated.startDate.toISOString().split('T')[0]
                    : null,
                endDate: validated.endDate ? validated.endDate.toISOString().split('T')[0] : null,
                agencyId: validated.agencyId ?? null,
            })
            .returning();

        return event;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            throw new Error(`Event with name "${validated.name}" already exists`);
        }
        throw error;
    }
}

/**
 * Get an event by ID
 */
export async function getEventById(id: number) {
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);

    return event || null;
}

/**
 * Get all events with optional filtering
 */
export async function getAllEvents(options: EventFilterOptions = {}) {
    const conditions = [];

    if (options.agencyId !== undefined) {
        conditions.push(eq(events.agencyId, options.agencyId));
    }

    if (options.search) {
        conditions.push(
            sql`(
                ${events.name} ILIKE ${`%${options.search}%`} OR
                ${events.description} ILIKE ${`%${options.search}%`}
            )`
        );
    }

    if (conditions.length > 0) {
        return await db
            .select()
            .from(events)
            .where(and(...conditions))
            .orderBy(events.name);
    }

    return await db.select().from(events).orderBy(events.name);
}

/**
 * Update an event
 */
export async function updateEvent(id: number, input: UpdateEventInput) {
    // Validate input
    const validated = updateEventSchema.parse(input);

    // Check if event exists
    const existing = await getEventById(id);
    if (!existing) {
        throw new Error(`Event with ID ${id} not found`);
    }

    // Build update object (only include defined fields)
    const updateData: {
        name?: string;
        description?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        agencyId?: number | null;
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

    if (validated.startDate !== undefined) {
        updateData.startDate = validated.startDate
            ? validated.startDate.toISOString().split('T')[0]
            : null;
    }

    if (validated.endDate !== undefined) {
        updateData.endDate = validated.endDate
            ? validated.endDate.toISOString().split('T')[0]
            : null;
    }

    if (validated.agencyId !== undefined) {
        updateData.agencyId = validated.agencyId;
    }

    try {
        const [updated] = await db
            .update(events)
            .set(updateData)
            .where(eq(events.id, id))
            .returning();

        return updated;
    } catch (error: any) {
        // Handle unique constraint violations
        if (error.code === '23505') {
            throw new Error(`Event with name "${validated.name}" already exists`);
        }
        throw error;
    }
}

/**
 * Delete an event
 * Note: CASCADE handling is done by the database (CASCADE delete on author_events and repository_events)
 */
export async function deleteEvent(id: number) {
    // Check if event exists
    const existing = await getEventById(id);
    if (!existing) {
        throw new Error(`Event with ID ${id} not found`);
    }

    // Delete the event (CASCADE is handled by database foreign key constraints)
    await db.delete(events).where(eq(events.id, id));

    return { success: true };
}

/**
 * Associate an author with an event
 */
export async function associateAuthorWithEvent(input: AssociateAuthorWithEventInput) {
    // Validate input
    const validated = associateAuthorWithEventSchema.parse(input);

    // Verify author exists
    const author = await db
        .select()
        .from(authors)
        .where(eq(authors.id, validated.authorId))
        .limit(1);
    if (author.length === 0) {
        throw new Error(`Author with ID ${validated.authorId} not found`);
    }

    // Verify event exists
    const event = await db
        .select()
        .from(events)
        .where(eq(events.id, validated.eventId))
        .limit(1);
    if (event.length === 0) {
        throw new Error(`Event with ID ${validated.eventId} not found`);
    }

    try {
        await db.insert(authorEvents).values({
            authorId: validated.authorId,
            eventId: validated.eventId,
        });
        return { success: true };
    } catch (error: any) {
        // Handle unique constraint violations (already associated)
        if (error.code === '23505') {
            return { success: true, alreadyAssociated: true };
        }
        throw error;
    }
}

/**
 * Remove association between an author and an event
 */
export async function removeAuthorFromEvent(authorId: number, eventId: number) {
    await db
        .delete(authorEvents)
        .where(and(eq(authorEvents.authorId, authorId), eq(authorEvents.eventId, eventId)));

    return { success: true };
}

/**
 * Associate a repository with an event
 */
export async function associateRepositoryWithEvent(input: AssociateRepositoryWithEventInput) {
    // Validate input
    const validated = associateRepositoryWithEventSchema.parse(input);

    // Verify repository exists
    const repository = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, validated.repositoryId))
        .limit(1);
    if (repository.length === 0) {
        throw new Error(`Repository with ID ${validated.repositoryId} not found`);
    }

    // Verify event exists
    const event = await db
        .select()
        .from(events)
        .where(eq(events.id, validated.eventId))
        .limit(1);
    if (event.length === 0) {
        throw new Error(`Event with ID ${validated.eventId} not found`);
    }

    try {
        await db.insert(repositoryEvents).values({
            repositoryId: validated.repositoryId,
            eventId: validated.eventId,
        });
        return { success: true };
    } catch (error: any) {
        // Handle unique constraint violations (already associated)
        if (error.code === '23505') {
            return { success: true, alreadyAssociated: true };
        }
        throw error;
    }
}

/**
 * Remove association between a repository and an event
 */
export async function removeRepositoryFromEvent(repositoryId: number, eventId: number) {
    await db
        .delete(repositoryEvents)
        .where(
            and(
                eq(repositoryEvents.repositoryId, repositoryId),
                eq(repositoryEvents.eventId, eventId)
            )
        );

    return { success: true };
}

/**
 * Get all authors associated with an event
 */
export async function getAuthorsForEvent(eventId: number) {
    return await db
        .select({
            id: authors.id,
            githubId: authors.githubId,
            username: authors.username,
            name: authors.name,
            email: authors.email,
            agencyId: authors.agencyId,
            createdAt: authors.createdAt,
            updatedAt: authors.updatedAt,
        })
        .from(authorEvents)
        .innerJoin(authors, eq(authorEvents.authorId, authors.id))
        .where(eq(authorEvents.eventId, eventId))
        .orderBy(authors.name, authors.username);
}

/**
 * Get all repositories associated with an event
 */
export async function getRepositoriesForEvent(eventId: number) {
    return await db
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
        .from(repositoryEvents)
        .innerJoin(repositories, eq(repositoryEvents.repositoryId, repositories.id))
        .where(eq(repositoryEvents.eventId, eventId))
        .orderBy(repositories.fullName);
}

