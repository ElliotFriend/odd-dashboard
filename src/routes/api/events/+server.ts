import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllEvents, createEvent } from '$lib/server/services/event.service';
import { createEventSchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/events
 * List all events with optional filtering
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const agencyId = url.searchParams.get('agencyId');
        const search = url.searchParams.get('search');

        const filters: any = {};
        if (agencyId) {
            const id = parseInt(agencyId, 10);
            if (!isNaN(id)) {
                filters.agencyId = id;
            }
        }
        if (search) {
            filters.search = search;
        }

        const events = await getAllEvents(filters);
        return json({ data: events });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * POST /api/events
 * Create a new event
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const validated = createEventSchema.parse(body);
        const event = await createEvent(validated);
        return json({ data: event }, { status: 201 });
    } catch (error: any) {
        return handleError(error);
    }
};

