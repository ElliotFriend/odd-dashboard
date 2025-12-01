import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllRepositories, createRepository } from '$lib/server/services/repository.service';
import { createRepositorySchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/repositories
 * List all repositories with optional filtering
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const agencyId = url.searchParams.get('agencyId');
        const isFork = url.searchParams.get('isFork');
        const search = url.searchParams.get('search');

        const filters: any = {};
        if (agencyId) {
            const id = parseInt(agencyId, 10);
            if (!isNaN(id)) {
                filters.agencyId = id;
            }
        }
        if (isFork !== null) {
            filters.isFork = isFork === 'true';
        }
        if (search) {
            filters.search = search;
        }

        const repositories = await getAllRepositories(filters);
        return json({ data: repositories });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * POST /api/repositories
 * Create a new repository
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const validated = createRepositorySchema.parse(body);
        const repository = await createRepository(validated);
        return json({ data: repository }, { status: 201 });
    } catch (error: any) {
        return handleError(error);
    }
};

