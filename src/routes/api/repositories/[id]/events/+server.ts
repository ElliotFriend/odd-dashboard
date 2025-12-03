import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { repositoryEvents, events } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/repositories/[id]/events
 * Get all events for a repository
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const repositoryId = parseInt(params.id);
        if (isNaN(repositoryId)) {
            return errorResponse('Invalid repository ID', 400);
        }

        const results = await db
            .select({
                id: events.id,
                name: events.name,
                description: events.description,
                startDate: events.startDate,
                endDate: events.endDate,
                agencyId: events.agencyId,
                createdAt: events.createdAt,
                updatedAt: events.updatedAt,
            })
            .from(events)
            .innerJoin(repositoryEvents, eq(events.id, repositoryEvents.eventId))
            .where(eq(repositoryEvents.repositoryId, repositoryId))
            .orderBy(events.name);

        return json({
            success: true,
            data: results,
        });
    } catch (error) {
        return handleError(error);
    }
};
