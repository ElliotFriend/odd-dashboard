import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCommitsByRepository } from '$lib/server/services/commit.service';
import { db } from '$lib/server/db';
import { commits, authors } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/repositories/[id]/contributors
 * Get contributors for a repository
 */
export const GET: RequestHandler = async ({ params, url }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const branch = url.searchParams.get('branch');

        const options: any = {};
        if (startDate) {
            options.startDate = new Date(startDate);
        }
        if (endDate) {
            options.endDate = new Date(endDate);
        }
        if (branch) {
            options.branch = branch;
        }

        // Get commits for the repository
        const repositoryCommits = await getCommitsByRepository(id, options);

        // Get unique contributors with commit counts
        const contributors = await db
            .select({
                authorId: authors.id,
                githubId: authors.githubId,
                username: authors.username,
                name: authors.name,
                email: authors.email,
                commitCount: sql<number>`COUNT(DISTINCT ${commits.id})`,
            })
            .from(commits)
            .innerJoin(authors, eq(commits.authorId, authors.id))
            .where(eq(commits.repositoryId, id))
            .groupBy(authors.id)
            .orderBy(sql`${sql`COUNT(DISTINCT ${commits.id})`} DESC`);

        return json({ data: contributors });
    } catch (error: any) {
        return handleError(error);
    }
};
