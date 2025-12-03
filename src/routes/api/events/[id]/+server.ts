import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getEventById,
    updateEvent,
    deleteEvent,
    getAuthorsForEvent,
    getRepositoriesForEvent,
} from '$lib/server/services/event.service';
import { updateEventSchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/events/[id]
 * Get a single event by ID
 */
export const GET: RequestHandler = async ({ params, url }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const include = url.searchParams.get('include');
        const event = await getEventById(id);
        if (!event) {
            return errorResponse(404, `Event with ID ${id} not found`);
        }

        const response: any = { data: event };

        // Optionally include related data
        if (include) {
            const includes = include.split(',');
            if (includes.includes('authors')) {
                response.authors = await getAuthorsForEvent(id);
            }
            if (includes.includes('repositories')) {
                response.repositories = await getRepositoriesForEvent(id);
            }
        }

        return json(response);
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * PUT /api/events/[id]
 * Update an event
 */
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid event ID');
        }

        const body = await request.json();
        const validated = updateEventSchema.parse(body);
        const event = await updateEvent(id, validated);

        return json({ data: event });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * DELETE /api/events/[id]
 * Delete an event
 */
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid event ID');
        }

        await deleteEvent(id);
        return json({ success: true });
    } catch (error: any) {
        return handleError(error);
    }
};
