import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getEcosystemById,
    updateEcosystem,
    deleteEcosystem,
} from '$lib/server/services/ecosystem.service';
import { updateEcosystemSchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/ecosystems/[id]
 * Get a single ecosystem by ID
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid ecosystem ID');
        }

        const ecosystem = await getEcosystemById(id);
        if (!ecosystem) {
            return errorResponse(404, `Ecosystem with ID ${id} not found`);
        }

        return json({ data: ecosystem });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * PUT /api/ecosystems/[id]
 * Update an ecosystem
 */
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid ecosystem ID');
        }

        const body = await request.json();
        const validated = updateEcosystemSchema.parse(body);
        const ecosystem = await updateEcosystem(id, validated);

        return json({ data: ecosystem });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * DELETE /api/ecosystems/[id]
 * Delete an ecosystem
 */
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid ecosystem ID');
        }

        await deleteEcosystem(id);
        return json({ success: true });
    } catch (error: any) {
        return handleError(error);
    }
};
