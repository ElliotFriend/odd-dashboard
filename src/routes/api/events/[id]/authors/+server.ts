import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getAuthorsForEvent,
    associateAuthorWithEvent,
    removeAuthorFromEvent,
} from '$lib/server/services/event.service';
import { associateAuthorWithEventSchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/events/[id]/authors
 * Get all authors associated with an event
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const authors = await getAuthorsForEvent(id);
        return json({ data: authors });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * POST /api/events/[id]/authors
 * Associate an author with an event
 */
export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const eventId = parseInt(params.id, 10);
        if (isNaN(eventId)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const body = await request.json();
        const validated = associateAuthorWithEventSchema.parse({
            ...body,
            eventId,
        });

        const result = await associateAuthorWithEvent(validated);
        return json({ data: result }, { status: 201 });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * DELETE /api/events/[id]/authors
 * Remove an author from an event
 */
export const DELETE: RequestHandler = async ({ params, request }) => {
    try {
        const eventId = parseInt(params.id, 10);
        if (isNaN(eventId)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const body = await request.json();
        const authorId = body.authorId;
        if (!authorId || typeof authorId !== 'number') {
            return errorResponse(400, 'authorId is required');
        }

        await removeAuthorFromEvent(authorId, eventId);
        return json({ success: true });
    } catch (error: any) {
        return handleError(error);
    }
};

