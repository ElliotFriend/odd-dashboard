import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAgencyById } from '$lib/server/services/agency.service';
import { createOrUpdateRepositoryFromGitHub } from '$lib/server/services/repository.service';
import { getRepository } from '$lib/server/github/fetchers';
import { handleError, errorResponse } from '$lib/server/api/errors';

/**
 * POST /api/agencies/[id]/repositories
 * Bulk associate repositories with an agency by GitHub URLs
 *
 * Request body:
 * {
 *   "urls": ["https://github.com/owner/repo1", "https://github.com/owner/repo2", ...]
 * }
 */
export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const agencyId = parseInt(params.id, 10);

        if (isNaN(agencyId)) {
            return errorResponse(400, 'Invalid agency ID');
        }

        // Check if agency exists
        const agency = await getAgencyById(agencyId);
        if (!agency) {
            return errorResponse(404, 'Agency not found');
        }

        const body = await request.json();
        const { urls } = body;

        if (!Array.isArray(urls)) {
            return errorResponse(400, 'urls must be an array');
        }

        if (urls.length === 0) {
            return errorResponse(400, 'At least one URL is required');
        }

        let associated = 0;
        let created = 0;
        let errors = 0;
        const errorDetails: string[] = [];

        for (const url of urls) {
            try {
                // Parse GitHub URL to extract owner and repo
                const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
                if (!match) {
                    errorDetails.push(`Invalid GitHub URL: ${url}`);
                    errors++;
                    continue;
                }

                const [, owner, repo] = match;
                const repoName = repo.replace(/\.git$/, ''); // Remove .git suffix if present

                // Fetch repository data from GitHub
                const githubRepo = await getRepository(owner, repoName);

                // Create or update repository and associate with agency
                const { repository, created: wasCreated } = await createOrUpdateRepositoryFromGitHub(
                    githubRepo,
                    {
                        agencyId,
                        detectFork: true,
                        detectRename: true,
                    }
                );

                associated++;
                if (wasCreated) {
                    created++;
                }
            } catch (error: any) {
                console.error(`Error processing ${url}:`, error);
                errorDetails.push(`${url}: ${error.message}`);
                errors++;
            }
        }

        return json({
            associated,
            created,
            errors,
            errorDetails: errors > 0 ? errorDetails : undefined,
        });
    } catch (error: any) {
        return handleError(error);
    }
};
