import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/lib/server/db';
import { repositories, commits, authors } from '../src/lib/server/db/schema';
import { syncRepositoryCommits } from '../src/lib/server/services/sync.service';
import { eq, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Test the sync service by syncing commits for a repository.
 * 
 * Usage:
 *   pnpm tsx scripts/test-sync.ts <repository_id> [initial]
 * 
 * Examples:
 *   pnpm tsx scripts/test-sync.ts 1          # Incremental sync
 *   pnpm tsx scripts/test-sync.ts 1 initial  # Initial sync (all commits)
 */
async function testSync() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error('Usage: pnpm tsx scripts/test-sync.ts <repository_id> [initial]');
        console.error('Examples:');
        console.error('  pnpm tsx scripts/test-sync.ts 1          # Incremental sync');
        console.error('  pnpm tsx scripts/test-sync.ts 1 initial  # Initial sync (all commits)');
        process.exit(1);
    }

    const repositoryId = parseInt(args[0], 10);
    const initialSync = args[1] === 'initial';

    if (isNaN(repositoryId)) {
        console.error('Error: repository_id must be a number');
        process.exit(1);
    }

    console.log(`🔍 Testing sync service:`);
    console.log(`   Repository ID: ${repositoryId}`);
    console.log(`   Sync type: ${initialSync ? 'Initial (all commits)' : 'Incremental (since last_synced_at)'}`);
    console.log('');

    try {
        // Get repository info
        const [repo] = await db
            .select()
            .from(repositories)
            .where(eq(repositories.id, repositoryId))
            .limit(1);

        if (!repo) {
            console.error(`❌ Repository with ID ${repositoryId} not found`);
            console.error('   Use scripts/add-test-repository.ts to add a repository first');
            process.exit(1);
        }

        console.log(`📦 Repository: ${repo.fullName}`);
        console.log(`   Default branch: ${repo.defaultBranch}`);
        console.log(`   Last synced: ${repo.lastSyncedAt ? repo.lastSyncedAt.toISOString() : 'Never'}`);
        console.log('');

        // Get counts before sync
        const [commitCountBefore] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(commits)
            .where(eq(commits.repositoryId, repositoryId));

        const [authorCountBefore] = await db
            .select({ count: sql<number>`COUNT(DISTINCT ${authors.id})` })
            .from(authors)
            .innerJoin(commits, eq(commits.authorId, authors.id))
            .where(eq(commits.repositoryId, repositoryId));

        console.log('📊 Before sync:');
        console.log(`   Commits in database: ${commitCountBefore.count}`);
        console.log(`   Authors in database: ${authorCountBefore.count}`);
        console.log('');

        // Run sync
        console.log('🔄 Starting sync...');
        const startTime = Date.now();
        const result = await syncRepositoryCommits(repositoryId, {
            initialSync,
            batchSize: 100, // Smaller batch size for testing
        });
        const duration = Date.now() - startTime;

        console.log('');
        console.log('✅ Sync completed!');
        console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log('');
        console.log('📈 Sync statistics:');
        console.log(`   Commits processed: ${result.commitsProcessed}`);
        console.log(`   Commits created: ${result.commitsCreated}`);
        console.log(`   Authors created: ${result.authorsCreated}`);
        if (result.errors.length > 0) {
            console.log(`   Errors: ${result.errors.length}`);
            result.errors.forEach((error, index) => {
                console.log(`     ${index + 1}. ${error}`);
            });
        } else {
            console.log(`   Errors: 0`);
        }
        console.log('');

        // Get counts after sync
        const [commitCountAfter] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(commits)
            .where(eq(commits.repositoryId, repositoryId));

        const [authorCountAfter] = await db
            .select({ count: sql<number>`COUNT(DISTINCT ${authors.id})` })
            .from(authors)
            .innerJoin(commits, eq(commits.authorId, authors.id))
            .where(eq(commits.repositoryId, repositoryId));

        // Get updated repository info
        const [updatedRepo] = await db
            .select()
            .from(repositories)
            .where(eq(repositories.id, repositoryId))
            .limit(1);

        console.log('📊 After sync:');
        console.log(`   Commits in database: ${commitCountAfter.count} (+${commitCountAfter.count - commitCountBefore.count})`);
        console.log(`   Authors in database: ${authorCountAfter.count} (+${authorCountAfter.count - authorCountBefore.count})`);
        console.log(`   Last synced: ${updatedRepo?.lastSyncedAt?.toISOString() || 'Never'}`);
        console.log('');

        // Show sample commits
        const sampleCommits = await db
            .select({
                sha: commits.sha,
                commitDate: commits.commitDate,
                authorName: authors.name,
                authorEmail: authors.email,
            })
            .from(commits)
            .innerJoin(authors, eq(commits.authorId, authors.id))
            .where(eq(commits.repositoryId, repositoryId))
            .orderBy(sql`${commits.commitDate} DESC`)
            .limit(5);

        if (sampleCommits.length > 0) {
            console.log('📝 Sample commits (most recent):');
            sampleCommits.forEach((commit, index) => {
                console.log(`   ${index + 1}. ${commit.sha.substring(0, 7)} - ${commit.authorName || commit.authorEmail || 'Unknown'}`);
                console.log(`      Date: ${commit.commitDate.toISOString()}`);
            });
        }
    } catch (error: any) {
        console.error('❌ Error during sync:');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

testSync();

