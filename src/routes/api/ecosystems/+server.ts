import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllEcosystems, createEcosystem } from '$lib/server/services/ecosystem.service';
import { createEcosystemSchema } from '$lib/server/db/validators';
import { errorResponse, handleError } from '$lib/server/api/errors';

/**
 * GET /api/ecosystems
 * List all ecosystems
 */
export const GET: RequestHandler = async () => {
    try {
        const ecosystems = await getAllEcosystems();
        return json({ data: ecosystems });
    } catch (error: any) {
        return handleError(error);
    }
};

/**
 * POST /api/ecosystems
 * Create a new ecosystem
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const validated = createEcosystemSchema.parse(body);
        const ecosystem = await createEcosystem(validated);
        return json({ data: ecosystem }, { status: 201 });
    } catch (error: any) {
        return handleError(error);
    }
};
