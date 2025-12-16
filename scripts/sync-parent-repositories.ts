import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/lib/server/db';
import { repositories, commits, authors } from '../src/lib/server/db/schema';
import { syncRepositoryCommits } from '../src/lib/server/services/sync.service';
import { eq, sql, inArray } from 'drizzle-orm';

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
 * Sync all parent repositories (repositories that have forks pointing to them).
 *
 * This script is useful after bulk imports where forks are synced before their parents.
 * It ensures parent repositories have all their commits before running fork attribution fixes.
 *
 * Usage:
 *   pnpm tsx scripts/sync-parent-repositories.ts [options]
 *
 * Options:
 *   --unsynced-only      Only sync parents that have never been synced (lastSyncedAt is null)
 *   --batch-size=N       Number of commits to fetch per batch (default: 1000)
 *   --continue-on-error  Continue syncing even if some repositories fail
 *   --dry-run            Show which parents would be synced without actually syncing
 *
 * Examples:
 *   pnpm tsx scripts/sync-parent-repositories.ts --dry-run
 *   pnpm tsx scripts/sync-parent-repositories.ts --unsynced-only
 *   pnpm tsx scripts/sync-parent-repositories.ts --batch-size=500 --continue-on-error
 */
async function syncParentRepositories() {
    const args = process.argv.slice(2);

    // Parse options
    const unsyncedOnly = args.includes('--unsynced-only');
    const continueOnError = args.includes('--continue-on-error');
    const isDryRun = args.includes('--dry-run');
    const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 1000;

    if (batchSizeArg && (isNaN(batchSize) || batchSize < 1)) {
        console.error('Error: --batch-size must be a positive number');
        process.exit(1);
    }

    console.log('🔗 Starting parent repository sync');
    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No syncing will be performed');
    }
    console.log('');
    console.log('Options:');
    console.log(`   Unsynced only: ${unsyncedOnly ? 'Yes' : 'No'}`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Continue on error: ${continueOnError ? 'Yes' : 'No'}`);
    console.log('');

    try {
        // Find all parent repository IDs that have forks pointing to them
        console.log('🔍 Finding parent repositories...');
        const parentIdsResult = await db
            .selectDistinct({ parentId: repositories.parentRepositoryId })
            .from(repositories)
            .where(sql`${repositories.parentRepositoryId} IS NOT NULL`);

        const parentIds = parentIdsResult
            .map(row => row.parentId)
            .filter((id): id is number => id !== null);

        if (parentIds.length === 0) {
            console.log('   No parent repositories found (no forks have parent links).');
            console.log('');
            console.log('💡 Tip: Run the link-fork-parents.ts script first to link forks to parents:');
            console.log('   pnpm tsx scripts/link-fork-parents.ts');
            return;
        }

        console.log(`   Found ${parentIds.length} parent repositories with forks`);
        console.log('');

        // Fetch parent repositories
        let parentsQuery = db
            .select()
            .from(repositories)
            .where(inArray(repositories.id, parentIds));

        const parents = await parentsQuery.orderBy(repositories.fullName);

        console.log('📦 Parent repositories to sync:');
        for (const parent of parents) {
            // Count commits and forks
            const [commitCount] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(commits)
                .where(eq(commits.repositoryId, parent.id));

            const [forkCount] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(repositories)
                .where(eq(repositories.parentRepositoryId, parent.id));

            const syncStatus = parent.lastSyncedAt
                ? `synced ${new Date(parent.lastSyncedAt).toLocaleDateString()}`
                : 'never synced';

            console.log(`   ${parent.fullName} (ID: ${parent.id})`);
            console.log(`      Commits: ${commitCount.count.toLocaleString()}, Forks: ${forkCount.count}, Status: ${syncStatus}`);
        }
        console.log('');

        // Filter by synced status if requested
        const parentsToSync = unsyncedOnly
            ? parents.filter(p => !p.lastSyncedAt)
            : parents;

        if (parentsToSync.length === 0) {
            console.log('   All parent repositories have already been synced.');
            console.log('   Use without --unsynced-only to re-sync all parents.');
            return;
        }

        if (parentsToSync.length < parents.length) {
            console.log(`   Filtering to ${parentsToSync.length} unsynced parent(s)`);
            console.log('');
        }

        if (isDryRun) {
            console.log('═'.repeat(60));
            console.log('🔍 DRY RUN: Would sync the following parent repositories:');
            parentsToSync.forEach(p => console.log(`   - ${p.fullName} (ID: ${p.id})`));
            console.log('═'.repeat(60));
            console.log('');
            console.log('Run without --dry-run to actually sync these repositories.');
            return;
        }

        const stats: SyncStats = {
            total: parentsToSync.length,
            completed: 0,
            failed: 0,
            skipped: 0,
            totalCommitsCreated: 0,
            totalCommitsSkippedBots: 0,
            totalAuthorsCreated: 0,
            errors: [],
        };

        const startTime = Date.now();

        // Sync each parent repository
        for (let i = 0; i < parentsToSync.length; i++) {
            const repo = parentsToSync[i];
            const progress = `[${i + 1}/${parentsToSync.length}]`;

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
        console.log('📈 PARENT SYNC SUMMARY');
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
            console.log('✅ All parent repositories synced successfully!');
            console.log('');
            console.log('💡 Next step: Run the fork attribution fix to clean up duplicates:');
            console.log('   pnpm tsx scripts/fix-fork-attribution.ts');
        }

        console.log('═'.repeat(60));

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

syncParentRepositories();
