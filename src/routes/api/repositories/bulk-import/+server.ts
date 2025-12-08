import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleError } from "$lib/server/api/errors";
import {
    createRepository,
    getRepositoryByFullName,
} from "$lib/server/services/repository.service";
import {
    getEcosystemByName,
    createEcosystem,
} from "$lib/server/services/ecosystem.service";
import { associateRepositoryWithEcosystem } from "$lib/server/services/ecosystem.service";
import { getRepository } from "$lib/server/github/fetchers";

interface ImportLine {
    eco_name: string;
    branch: string[];
    repo_url: string;
    tags: string[];
}

interface ImportResult {
    success: number;
    failed: number;
    errors: Array<{
        line: number;
        repo_url: string;
        error: string;
    }>;
}

/**
 * POST /api/repositories/bulk-import
 * Bulk import repositories from JSONL format
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { jsonl } = await request.json();

        if (!jsonl || typeof jsonl !== "string") {
            return json({ error: "JSONL data is required" }, { status: 400 });
        }

        const lines = jsonl
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const result: ImportResult = {
            success: 0,
            failed: 0,
            errors: [],
        };

        for (let i = 0; i < lines.length; i++) {
            const lineNumber = i + 1;
            try {
                const data: ImportLine = JSON.parse(lines[i]);

                // Validate required fields
                if (!data.repo_url) {
                    result.failed++;
                    result.errors.push({
                        line: lineNumber,
                        repo_url: data.repo_url || "unknown",
                        error: "Missing repo_url",
                    });
                    continue;
                }

                // Extract owner and repo from URL
                const urlMatch = data.repo_url.match(
                    /github\.com\/([^\/]+)\/([^\/\?#]+)/,
                );
                if (!urlMatch) {
                    result.failed++;
                    result.errors.push({
                        line: lineNumber,
                        repo_url: data.repo_url,
                        error: "Invalid GitHub URL format",
                    });
                    continue;
                }

                const [, owner, repo] = urlMatch;
                const fullName = `${owner}/${repo}`;

                // Determine which ecosystem to use
                const ecosystemName =
                    data.branch && data.branch.length > 0
                        ? data.branch[0]
                        : data.eco_name;

                if (!ecosystemName) {
                    result.failed++;
                    result.errors.push({
                        line: lineNumber,
                        repo_url: data.repo_url,
                        error: "Missing ecosystem name (eco_name or branch)",
                    });
                    continue;
                }

                // Find or create ecosystem
                let ecosystem = await getEcosystemByName(ecosystemName);
                if (!ecosystem) {
                    // Create the ecosystem
                    ecosystem = await createEcosystem({
                        name: ecosystemName,
                        parentId: null,
                    });
                }

                // Check if repository already exists
                let repository = await getRepositoryByFullName(fullName);

                if (!repository) {
                    // Fetch repository details from GitHub API
                    const githubRepo = await getRepository(owner, repo);

                    // Create repository with GitHub details
                    repository = await createRepository({
                        githubId: githubRepo.id,
                        fullName: githubRepo.full_name,
                        agencyId: null,
                        isFork: githubRepo.fork,
                        parentFullName: githubRepo.parent?.full_name || null,
                        defaultBranch: githubRepo.default_branch || 'main',
                    });
                }

                // Associate repository with ecosystem
                await associateRepositoryWithEcosystem(
                    repository.id,
                    ecosystem.id,
                );

                result.success++;
            } catch (error) {
                result.failed++;
                const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";
                result.errors.push({
                    line: lineNumber,
                    repo_url: lines[i].includes("repo_url")
                        ? JSON.parse(lines[i]).repo_url
                        : "unknown",
                    error: errorMessage,
                });
            }
        }

        return json(result);
    } catch (error) {
        return handleError(error);
    }
};
