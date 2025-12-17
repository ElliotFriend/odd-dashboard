import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthorDetails } from '$lib/server/services/author.service';
import { handleError, errorResponse } from '$lib/server/api/errors';

/**
 * GET /api/contributors/[id]
 * Get contributor details with statistics over a date range
 *
 * Query parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: today)
 */
export const GET: RequestHandler = async ({ params, url }) => {
    try {
        const authorId = parseInt(params.id, 10);

        if (isNaN(authorId)) {
            return errorResponse(400, 'Invalid author ID');
        }

        // Get date range from query params
        const startDateParam = url.searchParams.get('startDate');
        const endDateParam = url.searchParams.get('endDate');

        // Default to last 30 days
        const endDate = endDateParam || new Date().toISOString().split('T')[0];
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultStartDate.getDate() - 30);
        const startDate = startDateParam || defaultStartDate.toISOString().split('T')[0];

        const authorDetails = await getAuthorDetails(authorId, startDate, endDate);

        if (!authorDetails) {
            return errorResponse(404, 'Author not found');
        }

        return json(authorDetails);
    } catch (error: any) {
        return handleError(error);
    }
};
