import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllRepositories, createRepository } from '$lib/server/services/repository.service';
import { createRepositorySchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/repositories
 * List all repositories with optional filtering, statistics, sorting, and pagination
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const agencyId = url.searchParams.get('agencyId');
        const eventId = url.searchParams.get('eventId');
        const excludeForks = url.searchParams.get('excludeForks');
        const search = url.searchParams.get('search');
        const sortBy = url.searchParams.get('sortBy');
        const sortOrder = url.searchParams.get('sortOrder');
        const limit = url.searchParams.get('limit');
        const offset = url.searchParams.get('offset');

        const filters: any = {};
        if (agencyId) {
            const id = parseInt(agencyId, 10);
            if (!isNaN(id)) {
                filters.agencyId = id;
            }
        }
        if (eventId) {
            const id = parseInt(eventId, 10);
            if (!isNaN(id)) {
                filters.eventId = id;
            }
        }
        if (excludeForks === 'true') {
            filters.excludeForks = true;
        }
        if (search) {
            filters.search = search;
        }
        if (sortBy && ['commits', 'contributors', 'lastCommitDate', 'fullName'].includes(sortBy)) {
            filters.sortBy = sortBy as 'commits' | 'contributors' | 'lastCommitDate' | 'fullName';
        }
        if (sortOrder && ['asc', 'desc'].includes(sortOrder)) {
            filters.sortOrder = sortOrder as 'asc' | 'desc';
        }
        if (limit) {
            const limitNum = parseInt(limit, 10);
            if (!isNaN(limitNum) && limitNum > 0) {
                filters.limit = limitNum;
            }
        }
        if (offset) {
            const offsetNum = parseInt(offset, 10);
            if (!isNaN(offsetNum) && offsetNum >= 0) {
                filters.offset = offsetNum;
            }
        }

        const result = await getAllRepositories(filters);
        return json(result);
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
