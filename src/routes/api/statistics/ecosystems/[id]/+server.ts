import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getEcosystemStatistics } from "$lib/server/services/statistics.service";
import { handleError } from "$lib/server/api/errors";

/**
 * GET /api/statistics/ecosystems/[id]
 * Get statistics for a specific ecosystem
 */
export const GET: RequestHandler = async ({ params, url }) => {
    try {
        const ecosystemId = parseInt(params.id);

        const startDateParam = url.searchParams.get("startDate");
        const endDateParam = url.searchParams.get("endDate");
        const includeChildren = url.searchParams.get("includeChildren") === "true";

        const options: { startDate?: Date; endDate?: Date; includeChildren?: boolean } = {
            includeChildren,
        };
        if (startDateParam) {
            options.startDate = new Date(startDateParam);
        }
        if (endDateParam) {
            options.endDate = new Date(endDateParam);
        }

        const statistics = await getEcosystemStatistics(ecosystemId, options);

        return json(statistics);
    } catch (error) {
        return handleError(error);
    }
};
