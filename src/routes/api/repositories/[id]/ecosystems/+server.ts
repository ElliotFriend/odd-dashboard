import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getEcosystemsForRepository,
    associateRepositoryWithEcosystem,
    removeRepositoryFromEcosystem,
} from '$lib/server/services/ecosystem.service';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/repositories/[id]/ecosystems
 * Get all ecosystems for a repository
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const repositoryId = parseInt(params.id);
        if (isNaN(repositoryId)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        const ecosystems = await getEcosystemsForRepository(repositoryId);

        return json({
            success: true,
            data: ecosystems,
        });
    } catch (error) {
        return handleError(error);
    }
};

/**
 * POST /api/repositories/[id]/ecosystems
 * Associate a repository with an ecosystem
 * Body: { ecosystemId: number }
 */
export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const repositoryId = parseInt(params.id);
        if (isNaN(repositoryId)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        const body = await request.json();
        const { ecosystemId } = body;

        if (!ecosystemId || isNaN(ecosystemId)) {
            return errorResponse(400, 'ecosystemId is required and must be a number');
        }

        await associateRepositoryWithEcosystem(repositoryId, ecosystemId);

        return json({
            success: true,
            message: 'Repository associated with ecosystem',
        });
    } catch (error) {
        return handleError(error);
    }
};

/**
 * DELETE /api/repositories/[id]/ecosystems
 * Remove repository from an ecosystem
 * Body: { ecosystemId: number }
 */
export const DELETE: RequestHandler = async ({ params, request }) => {
    try {
        const repositoryId = parseInt(params.id);
        if (isNaN(repositoryId)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        const body = await request.json();
        const { ecosystemId } = body;

        if (!ecosystemId || isNaN(ecosystemId)) {
            return errorResponse(400, 'ecosystemId is required and must be a number');
        }

        await removeRepositoryFromEcosystem(repositoryId, ecosystemId);

        return json({
            success: true,
            message: 'Repository removed from ecosystem',
        });
    } catch (error) {
        return handleError(error);
    }
};
