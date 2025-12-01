import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllAuthors } from '$lib/server/services/author.service';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/authors
 * List all authors with optional filtering
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const agencyId = url.searchParams.get('agencyId');
        const githubId = url.searchParams.get('githubId');
        const email = url.searchParams.get('email');
        const search = url.searchParams.get('search');

        const filters: any = {};
        if (agencyId) {
            const id = parseInt(agencyId, 10);
            if (!isNaN(id)) {
                filters.agencyId = id;
            }
        }
        if (githubId) {
            const id = parseInt(githubId, 10);
            if (!isNaN(id)) {
                filters.githubId = id;
            }
        }
        if (email) {
            filters.email = email;
        }
        if (search) {
            filters.search = search;
        }

        const authors = await getAllAuthors(filters);
        return json({ data: authors });
    } catch (error: any) {
        return handleError(error);
    }
};

