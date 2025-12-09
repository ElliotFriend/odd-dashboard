import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { handleError } from "$lib/server/api/errors";
import { db } from "$lib/server/db";
import { repositories } from "$lib/server/db/schema";
import { sql, lt, isNull, or } from "drizzle-orm";
import { syncRepositoryCommits } from "$lib/server/services/sync.service";
import { RepositoryNotFoundError } from "$lib/server/github/errors";
import { markRepositoryAsMissing } from "$lib/server/services/repository.service";

interface SyncBatchRequest {
    olderThan: string; // e.g., "24h", "7d", "30d", "never"
    skipMissing?: boolean; // Skip repositories marked as missing
}

interface SyncBatchResult {
    totalProcessed: number;
    successful: number;
    failed: number;
    markedMissing: number;
    totalCommitsCreated: number;
    totalAuthorsCreated: number;
    results: Array<{
        repositoryId: number;
        fullName: string;
        status: "success" | "failed" | "missing";
        commitsCreated?: number;
        authorsCreated?: number;
        error?: string;
    }>;
}

/**
 * Parse time period string to Date
 * Supported formats: "24h", "7d", "30d", "never"
 */
function parseTimePeriod(period: string): Date | null {
    if (period === "never") {
        return null;
    }

    const match = period.match(/^(\d+)(h|d)$/);
    if (!match) {
        throw new Error(`Invalid time period format: ${period}. Use format like "24h" or "7d"`);
    }

    const [, amount, unit] = match;
    const now = new Date();
    const value = parseInt(amount, 10);

    if (unit === "h") {
        now.setHours(now.getHours() - value);
    } else if (unit === "d") {
        now.setDate(now.getDate() - value);
    }

    return now;
}

/**
 * POST /api/repositories/sync-batch
 * Batch sync repositories that haven't been synced recently
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { olderThan, skipMissing = true } = (await request.json()) as SyncBatchRequest;

        if (!olderThan) {
            return json({ error: "olderThan parameter is required" }, { status: 400 });
        }

        // Parse the time period
        const cutoffDate = parseTimePeriod(olderThan);

        // Build query to find repositories to sync
        const conditions = [];

        if (cutoffDate === null) {
            // "never" - only sync repositories that have never been synced
            conditions.push(isNull(repositories.lastSyncedAt));
        } else {
            // Sync repositories that haven't been synced since cutoffDate OR never synced
            conditions.push(
                or(
                    isNull(repositories.lastSyncedAt),
                    lt(repositories.lastSyncedAt, cutoffDate),
                ),
            );
        }

        // Optionally skip missing repositories
        if (skipMissing) {
            conditions.push(sql`${repositories.isMissing} = false`);
        }

        // Fetch repositories to sync
        const reposToSync = await db
            .select()
            .from(repositories)
            .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
            .orderBy(repositories.fullName);

        const result: SyncBatchResult = {
            totalProcessed: reposToSync.length,
            successful: 0,
            failed: 0,
            markedMissing: 0,
            totalCommitsCreated: 0,
            totalAuthorsCreated: 0,
            results: [],
        };

        // Sync each repository
        for (const repo of reposToSync) {
            try {
                const syncResult = await syncRepositoryCommits(repo.id, {
                    initialSync: !repo.lastSyncedAt,
                    batchSize: 1000,
                });

                result.successful++;
                result.totalCommitsCreated += syncResult.commitsCreated;
                result.totalAuthorsCreated += syncResult.authorsCreated;

                result.results.push({
                    repositoryId: repo.id,
                    fullName: repo.fullName,
                    status: "success",
                    commitsCreated: syncResult.commitsCreated,
                    authorsCreated: syncResult.authorsCreated,
                });
            } catch (error: any) {
                // Check if repository is missing
                if (error instanceof RepositoryNotFoundError) {
                    await markRepositoryAsMissing(repo.id);
                    result.markedMissing++;
                    result.results.push({
                        repositoryId: repo.id,
                        fullName: repo.fullName,
                        status: "missing",
                        error: "Repository not found (marked as missing)",
                    });
                } else {
                    result.failed++;
                    result.results.push({
                        repositoryId: repo.id,
                        fullName: repo.fullName,
                        status: "failed",
                        error: error.message || "Unknown error",
                    });
                }
            }
        }

        return json({ data: result });
    } catch (error) {
        return handleError(error);
    }
};
