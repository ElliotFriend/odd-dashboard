import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCommitsByRepository, getCommitsByAuthor } from '$lib/server/services/commit.service';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/commits
 * List commits with optional filtering
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const repositoryId = url.searchParams.get('repositoryId');
        const authorId = url.searchParams.get('authorId');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const branch = url.searchParams.get('branch');

        // Require either repositoryId or authorId
        if (!repositoryId && !authorId) {
            return errorResponse(400, 'Either repositoryId or authorId must be provided');
        }

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

        let commits: any[] = [];
        if (repositoryId) {
            const repoId = parseInt(repositoryId, 10);
            if (isNaN(repoId)) {
                return errorResponse(400, 'Invalid repositoryId');
            }
            commits = await getCommitsByRepository(repoId, options);
        } else if (authorId) {
            const authId = parseInt(authorId, 10);
            if (isNaN(authId)) {
                return errorResponse(400, 'Invalid authorId');
            }
            commits = await getCommitsByAuthor(authId, options);
        }

        return json({ data: commits });
    } catch (error: any) {
        return handleError(error);
    }
};
