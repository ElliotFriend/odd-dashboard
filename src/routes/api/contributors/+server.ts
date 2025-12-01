import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { commits, authors, repositories } from '$lib/server/db/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/contributors
 * Get contributors over a time period with optional filtering
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const ecosystemId = url.searchParams.get('ecosystemId');
        const agencyId = url.searchParams.get('agencyId');
        const eventId = url.searchParams.get('eventId');

        if (!startDate || !endDate) {
            return errorResponse(400, 'startDate and endDate are required');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return errorResponse(400, 'Invalid date format');
        }

        // Build conditions for filtering
        const conditions = [
            gte(commits.commitDate, start),
            lte(commits.commitDate, end),
        ];

        // Build query - join repositories if we need to filter by agency
        if (agencyId) {
            const agId = parseInt(agencyId, 10);
            if (!isNaN(agId)) {
                const contributorStats = await db
                    .select({
                        authorId: commits.authorId,
                        commitCount: sql<number>`COUNT(DISTINCT ${commits.id})`,
                    })
                    .from(commits)
                    .innerJoin(repositories, eq(commits.repositoryId, repositories.id))
                    .where(and(...conditions, eq(repositories.agencyId, agId)))
                    .groupBy(commits.authorId);

                // Get author details
                const authorIds = contributorStats.map((stat) => stat.authorId);
                if (authorIds.length === 0) {
                    return json({ data: [] });
                }

                const contributorDetails = await db
                    .select()
                    .from(authors)
                    .where(inArray(authors.id, authorIds));

                // Combine stats with author details
                const contributors = contributorDetails.map((author) => {
                    const stats = contributorStats.find((stat) => stat.authorId === author.id);
                    return {
                        ...author,
                        commitCount: stats?.commitCount || 0,
                    };
                });

                contributors.sort((a, b) => (b.commitCount as number) - (a.commitCount as number));
                return json({ data: contributors });
            }
        }

        // Default query without agency filter
        const contributorStats = await db
            .select({
                authorId: commits.authorId,
                commitCount: sql<number>`COUNT(DISTINCT ${commits.id})`,
            })
            .from(commits)
            .where(and(...conditions))
            .groupBy(commits.authorId);

        // Note: ecosystemId and eventId filtering would require additional joins
        // For now, we'll implement basic filtering. Full filtering can be added later.

        // Get author details for each contributor
        const authorIds = contributorStats.map((stat) => stat.authorId);
        if (authorIds.length === 0) {
            return json({ data: [] });
        }

        const contributorDetails = await db
            .select()
            .from(authors)
            .where(inArray(authors.id, authorIds));

        // Combine stats with author details
        const contributors = contributorDetails.map((author) => {
            const stats = contributorStats.find((stat) => stat.authorId === author.id);
            return {
                ...author,
                commitCount: stats?.commitCount || 0,
            };
        });

        // Sort by commit count descending
        contributors.sort((a, b) => (b.commitCount as number) - (a.commitCount as number));

        return json({ data: contributors });
    } catch (error: any) {
        return handleError(error);
    }
};

