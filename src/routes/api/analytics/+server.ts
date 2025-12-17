import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAnalytics } from '$lib/server/services/analytics.service';
import { handleError } from '$lib/server/api/errors';

/**
 * GET /api/analytics
 * Get analytics data for a date range
 *
 * Query parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: today)
 * - limit: number of top items to return (default: 10)
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const startDateParam = url.searchParams.get('startDate');
        const endDateParam = url.searchParams.get('endDate');
        const limitParam = url.searchParams.get('limit');

        // Default to last 30 days
        const endDate = endDateParam || new Date().toISOString().split('T')[0];
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultStartDate.getDate() - 30);
        const startDate = startDateParam || defaultStartDate.toISOString().split('T')[0];

        const limit = limitParam ? parseInt(limitParam, 10) : 10;

        if (isNaN(limit) || limit < 1 || limit > 100) {
            return json({ error: 'Limit must be between 1 and 100' }, { status: 400 });
        }

        const analytics = await getAnalytics(startDate, endDate, limit);
        return json(analytics);
    } catch (error: any) {
        return handleError(error);
    }
};
