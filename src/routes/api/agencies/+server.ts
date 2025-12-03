import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllAgencies, createAgency } from '$lib/server/services/agency.service';
import { createAgencySchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/agencies
 * List all agencies
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const agencies = await getAllAgencies();
        return json({ data: agencies });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * POST /api/agencies
 * Create a new agency
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const validated = createAgencySchema.parse(body);
        const agency = await createAgency(validated);
        return json({ data: agency }, { status: 201 });
    } catch (error: any) {
        return handleError(error);
    }
};
