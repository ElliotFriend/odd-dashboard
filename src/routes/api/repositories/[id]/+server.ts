import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getRepositoryById,
    updateRepository,
    deleteRepository,
} from '$lib/server/services/repository.service';
import { updateRepositorySchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/repositories/[id]
 * Get a single repository by ID
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        const repository = await getRepositoryById(id);
        if (!repository) {
            return errorResponse(404, `Repository with ID ${id} not found`);
        }

        return json({ data: repository });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * PUT /api/repositories/[id]
 * Update a repository
 */
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        const body = await request.json();
        const validated = updateRepositorySchema.parse(body);
        const repository = await updateRepository(id, validated);

        return json({ data: repository });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * DELETE /api/repositories/[id]
 * Delete a repository
 */
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        await deleteRepository(id);
        return json({ success: true });
    } catch (error: any) {
        return handleError(error);
    }
};

