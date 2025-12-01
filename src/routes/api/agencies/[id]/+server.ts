import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getAgencyById,
    updateAgency,
    deleteAgency,
} from '$lib/server/services/agency.service';
import { updateAgencySchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/agencies/[id]
 * Get a single agency by ID
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid agency ID');
        }

        const agency = await getAgencyById(id);
        if (!agency) {
            return errorResponse(404, `Agency with ID ${id} not found`);
        }

        return json({ data: agency });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * PUT /api/agencies/[id]
 * Update an agency
 */
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid agency ID');
        }

        const body = await request.json();
        const validated = updateAgencySchema.parse(body);
        const agency = await updateAgency(id, validated);

        return json({ data: agency });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * DELETE /api/agencies/[id]
 * Delete an agency
 */
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid agency ID');
        }

        await deleteAgency(id);
        return json({ success: true });
    } catch (error: any) {
        return handleError(error);
    }
};

