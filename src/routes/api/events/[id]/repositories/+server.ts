import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getRepositoriesForEvent,
    associateRepositoryWithEvent,
    removeRepositoryFromEvent,
} from '$lib/server/services/event.service';
import { associateRepositoryWithEventSchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/events/[id]/repositories
 * Get all repositories associated with an event
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const repositories = await getRepositoriesForEvent(id);
        return json({ data: repositories });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * POST /api/events/[id]/repositories
 * Associate a repository with an event
 */
export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const eventId = parseInt(params.id, 10);
        if (isNaN(eventId)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const body = await request.json();
        const validated = associateRepositoryWithEventSchema.parse({
            ...body,
            eventId,
        });

        const result = await associateRepositoryWithEvent(validated);
        return json({ data: result }, { status: 201 });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * DELETE /api/events/[id]/repositories
 * Remove a repository from an event
 */
export const DELETE: RequestHandler = async ({ params, request }) => {
    try {
        const eventId = parseInt(params.id, 10);
        if (isNaN(eventId)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const body = await request.json();
        const repositoryId = body.repositoryId;
        if (!repositoryId || typeof repositoryId !== 'number') {
            return errorResponse(400, 'repositoryId is required');
        }

        await removeRepositoryFromEvent(repositoryId, eventId);
        return json({ success: true });
    } catch (error: any) {
        return handleError(error);
    }
};

