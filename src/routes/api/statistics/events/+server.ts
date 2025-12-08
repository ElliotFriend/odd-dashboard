import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAllEventsStatistics } from "$lib/server/services/statistics.service";
import { handleError } from "$lib/server/api/errors";

/**
 * GET /api/statistics/events
 * Get statistics for all events
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const startDateParam = url.searchParams.get("startDate");
        const endDateParam = url.searchParams.get("endDate");

        const options: { startDate?: Date; endDate?: Date } = {};
        if (startDateParam) {
            options.startDate = new Date(startDateParam);
        }
        if (endDateParam) {
            options.endDate = new Date(endDateParam);
        }

        const statistics = await getAllEventsStatistics(options);

        return json(statistics);
    } catch (error) {
        return handleError(error);
    }
};
