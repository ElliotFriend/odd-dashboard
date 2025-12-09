import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleError } from "$lib/server/api/errors";
import {
    createRepository,
    getRepositoryByFullName,
} from "$lib/server/services/repository.service";
import { associateRepositoryWithEvent } from "$lib/server/services/event.service";
import { getRepository } from "$lib/server/github/fetchers";
import { RepositoryNotFoundError } from "$lib/server/github/errors";
import { syncRepositoryCommits } from "$lib/server/services/sync.service";

interface AddRepositoryRequest {
    repoUrls: string;
    eventId?: number;
}

interface AddResult {
    success: number;
    failed: number;
    skipped: number;
    results: Array<{
        url: string;
        status: "success" | "failed" | "skipped";
        repositoryId?: number;
        error?: string;
    }>;
}

/**
 * POST /api/repositories/add
 * Add one or more repositories with optional event association and immediate sync
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { repoUrls, eventId } = (await request.json()) as AddRepositoryRequest;

        if (!repoUrls || typeof repoUrls !== "string") {
            return json({ error: "Repository URLs are required" }, { status: 400 });
        }

        // Parse URLs from textarea (one per line)
        const urls = repoUrls
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        if (urls.length === 0) {
            return json({ error: "At least one repository URL is required" }, { status: 400 });
        }

        const result: AddResult = {
            success: 0,
            failed: 0,
            skipped: 0,
            results: [],
        };

        for (const url of urls) {
            try {
                // Extract owner and repo from URL
                const urlMatch = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
                if (!urlMatch) {
                    result.failed++;
                    result.results.push({
                        url,
                        status: "failed",
                        error: "Invalid GitHub URL format",
                    });
                    continue;
                }

                const [, owner, repo] = urlMatch;
                const fullName = `${owner}/${repo}`;

                // Check if repository already exists
                let repository = await getRepositoryByFullName(fullName);

                if (repository) {
                    result.skipped++;
                    result.results.push({
                        url,
                        status: "skipped",
                        repositoryId: repository.id,
                        error: "Repository already exists",
                    });
                    continue;
                }

                // Fetch repository details from GitHub API
                try {
                    const githubRepo = await getRepository(owner, repo);

                    // Create repository with GitHub details
                    repository = await createRepository({
                        githubId: githubRepo.id,
                        fullName: githubRepo.full_name,
                        agencyId: null,
                        isFork: githubRepo.fork,
                        parentFullName: githubRepo.parent?.full_name || null,
                        defaultBranch: githubRepo.default_branch || "main",
                    });
                } catch (error) {
                    // Handle repository not found errors
                    if (error instanceof RepositoryNotFoundError) {
                        result.failed++;
                        result.results.push({
                            url,
                            status: "failed",
                            error: "Repository not found or is not accessible (may be deleted or private)",
                        });
                        continue;
                    }
                    throw error;
                }

                // Associate with event if provided
                if (eventId) {
                    await associateRepositoryWithEvent({
                        repositoryId: repository.id,
                        eventId,
                    });
                }

                // Trigger immediate sync
                await syncRepositoryCommits(repository.id, {
                    initialSync: true,
                    batchSize: 1000,
                });

                result.success++;
                result.results.push({
                    url,
                    status: "success",
                    repositoryId: repository.id,
                });
            } catch (error) {
                result.failed++;
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                result.results.push({
                    url,
                    status: "failed",
                    error: errorMessage,
                });
            }
        }

        return json({ data: result });
    } catch (error) {
        return handleError(error);
    }
};
