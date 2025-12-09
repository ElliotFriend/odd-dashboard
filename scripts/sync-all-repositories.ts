import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/lib/server/db';
import { repositories, commits, authors } from '../src/lib/server/db/schema';
import { syncRepositoryCommits } from '../src/lib/server/services/sync.service';
import { eq, sql, isNull } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

interface SyncStats {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    totalCommitsCreated: number;
    totalCommitsSkippedBots: number;
    totalAuthorsCreated: number;
    errors: Array<{ repositoryId: number; fullName: string; error: string }>;
}

/**
 * Sync all repositories in the database.
 *
 * Usage:
 *   pnpm tsx scripts/sync-all-repositories.ts [options]
 *
 * Options:
 *   --unsynced-only    Only sync repositories that have never been synced (lastSyncedAt is null)
 *   --batch-size=N     Number of commits to fetch per batch (default: 1000)
 *   --continue-on-error Continue syncing even if some repositories fail
 *
 * Examples:
 *   pnpm tsx scripts/sync-all-repositories.ts
 *   pnpm tsx scripts/sync-all-repositories.ts --unsynced-only
 *   pnpm tsx scripts/sync-all-repositories.ts --batch-size=500 --continue-on-error
 */
async function syncAllRepositories() {
    const args = process.argv.slice(2);

    // Parse options
    const unsyncedOnly = args.includes('--unsynced-only');
    const continueOnError = args.includes('--continue-on-error');
    const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 1000;

    if (batchSizeArg && (isNaN(batchSize) || batchSize < 1)) {
        console.error('Error: --batch-size must be a positive number');
        process.exit(1);
    }

    console.log('🚀 Starting bulk repository sync');
    console.log('');
    console.log('Options:');
    console.log(`   Unsynced only: ${unsyncedOnly ? 'Yes' : 'No'}`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Continue on error: ${continueOnError ? 'Yes' : 'No'}`);
    console.log('');

    try {
        // Fetch repositories to sync
        console.log('📊 Fetching repositories...');
        let repoQuery = db.select().from(repositories);

        if (unsyncedOnly) {
            repoQuery = repoQuery.where(isNull(repositories.lastSyncedAt)) as any;
        }

        const repos = await repoQuery.orderBy(repositories.fullName);

        if (repos.length === 0) {
            console.log('   No repositories found to sync.');
            return;
        }

        console.log(`   Found ${repos.length} repositories to sync`);
        console.log('');

        const stats: SyncStats = {
            total: repos.length,
            completed: 0,
            failed: 0,
            skipped: 0,
            totalCommitsCreated: 0,
            totalCommitsSkippedBots: 0,
            totalAuthorsCreated: 0,
            errors: [],
        };

        const startTime = Date.now();

        // Sync each repository
        for (let i = 0; i < repos.length; i++) {
            const repo = repos[i];
            const progress = `[${i + 1}/${repos.length}]`;

            console.log(`${progress} 🔄 Syncing: ${repo.fullName} (ID: ${repo.id})`);

            try {
                const repoStartTime = Date.now();
                const result = await syncRepositoryCommits(repo.id, {
                    initialSync: !repo.lastSyncedAt, // Initial sync if never synced before
                    batchSize,
                });
                const duration = Date.now() - repoStartTime;

                stats.completed++;
                stats.totalCommitsCreated += result.commitsCreated;
                stats.totalCommitsSkippedBots += result.commitsSkippedBots;
                stats.totalAuthorsCreated += result.authorsCreated;

                console.log(`   ✅ Success (${(duration / 1000).toFixed(1)}s)`);
                console.log(`      Commits: ${result.commitsCreated}, Bots skipped: ${result.commitsSkippedBots}, Authors: ${result.authorsCreated}`);

                if (result.errors.length > 0) {
                    console.log(`      ⚠️  ${result.errors.length} errors during sync`);
                }
            } catch (error: any) {
                stats.failed++;
                const errorMessage = error.message || 'Unknown error';
                stats.errors.push({
                    repositoryId: repo.id,
                    fullName: repo.fullName,
                    error: errorMessage,
                });

                console.log(`   ❌ Failed: ${errorMessage}`);

                if (!continueOnError) {
                    console.log('');
                    console.log('Stopping due to error. Use --continue-on-error to continue syncing other repositories.');
                    throw error;
                }
            }

            console.log('');
        }

        const totalDuration = Date.now() - startTime;

        // Print summary
        console.log('═'.repeat(60));
        console.log('📈 SYNC SUMMARY');
        console.log('═'.repeat(60));
        console.log(`Total duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
        console.log('');
        console.log('Repositories:');
        console.log(`   Total: ${stats.total}`);
        console.log(`   Completed: ${stats.completed}`);
        console.log(`   Failed: ${stats.failed}`);
        console.log('');
        console.log('Data created:');
        console.log(`   Commits: ${stats.totalCommitsCreated.toLocaleString()}`);
        console.log(`   Bot commits skipped: ${stats.totalCommitsSkippedBots.toLocaleString()}`);
        console.log(`   Authors: ${stats.totalAuthorsCreated.toLocaleString()}`);
        console.log('');

        if (stats.errors.length > 0) {
            console.log('❌ Errors:');
            stats.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.fullName} (ID: ${error.repositoryId})`);
                console.log(`      ${error.error}`);
            });
            console.log('');
            console.log('You can retry failed repositories individually with:');
            console.log('   pnpm tsx scripts/test-sync.ts <repository_id> initial');
        } else {
            console.log('✅ All repositories synced successfully!');
        }

        console.log('═'.repeat(60));

        // Print database statistics
        console.log('');
        console.log('📊 Final database statistics:');

        const [totalCommits] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(commits);

        const [totalAuthors] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(authors);

        const [syncedRepos] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(repositories)
            .where(sql`${repositories.lastSyncedAt} IS NOT NULL`);

        console.log(`   Total repositories: ${repos.length}`);
        console.log(`   Synced repositories: ${syncedRepos.count}`);
        console.log(`   Total commits: ${totalCommits.count.toLocaleString()}`);
        console.log(`   Total authors: ${totalAuthors.count.toLocaleString()}`);

        if (stats.failed > 0) {
            process.exit(1);
        }
    } catch (error: any) {
        console.error('');
        console.error('❌ Fatal error during sync:');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

syncAllRepositories();
