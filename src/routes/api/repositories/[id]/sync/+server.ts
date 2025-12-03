import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncRepositoryCommits } from '$lib/server/services/sync.service';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * POST /api/repositories/[id]/sync
 * Trigger sync for a repository
 */
export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return errorResponse(400, 'Invalid repository ID');
        }

        const body = await request.json().catch(() => ({}));
        const initialSync = body.initialSync === true;
        const batchSize = body.batchSize ? parseInt(body.batchSize, 10) : 1000;

        if (batchSize && (isNaN(batchSize) || batchSize < 1)) {
            return errorResponse(400, 'batchSize must be a positive number');
        }

        const result = await syncRepositoryCommits(id, {
            initialSync,
            batchSize: batchSize || 1000,
        });

        return json({ data: result });
    } catch (error: any) {
        return handleError(error);
    }
};
