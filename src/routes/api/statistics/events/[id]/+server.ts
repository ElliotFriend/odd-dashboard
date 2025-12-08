import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getEventStatistics } from "$lib/server/services/statistics.service";
import { handleError } from "$lib/server/api/errors";

/**
 * GET /api/statistics/events/[id]
 * Get statistics for a specific event
 */
export const GET: RequestHandler = async ({ params, url }) => {
    try {
        const { id } = params;

        const startDateParam = url.searchParams.get("startDate");
        const endDateParam = url.searchParams.get("endDate");

        const options: { startDate?: Date; endDate?: Date } = {};
        if (startDateParam) {
            options.startDate = new Date(startDateParam);
        }
        if (endDateParam) {
            options.endDate = new Date(endDateParam);
        }

        const statistics = await getEventStatistics(id, options);

        return json(statistics);
    } catch (error) {
        return handleError(error);
    }
};
