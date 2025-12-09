import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/lib/server/db';
import { repositories, commits } from '../src/lib/server/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Fix fork attribution by removing duplicate commits from forks that exist in parent repositories.
 *
 * This script:
 * 1. Finds all fork repositories with parent_repository_id set
 * 2. For each fork, identifies commits that exist in both the fork and parent
 * 3. Deletes the duplicate commits from the fork (keeps them in parent)
 *
 * Usage:
 *   pnpm tsx scripts/fix-fork-attribution.ts
 */
async function fixForkAttribution() {
    console.log('🔧 Starting fork attribution fix...');
    console.log('');

    try {
        // Get all fork repositories with parent links
        const forks = await db
            .select({
                id: repositories.id,
                fullName: repositories.fullName,
                parentRepositoryId: repositories.parentRepositoryId,
                parentFullName: repositories.parentFullName,
            })
            .from(repositories)
            .where(and(
                eq(repositories.isFork, true),
                sql`${repositories.parentRepositoryId} IS NOT NULL`
            ));

        if (forks.length === 0) {
            console.log('✅ No forks with parent links found.');
            return;
        }

        console.log(`📊 Found ${forks.length} fork(s) with parent links:`);
        forks.forEach(fork => {
            console.log(`   - ${fork.fullName} → ${fork.parentFullName}`);
        });
        console.log('');

        let totalDuplicatesRemoved = 0;

        // Process each fork
        for (const fork of forks) {
            console.log(`🔄 Processing: ${fork.fullName}`);

            if (!fork.parentRepositoryId) {
                console.log('   ⚠️  No parent repository ID, skipping');
                continue;
            }

            // Count commits in fork before cleanup
            const [forkCommitCountBefore] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(commits)
                .where(eq(commits.repositoryId, fork.id));

            console.log(`   Fork commits before: ${forkCommitCountBefore.count}`);

            // Find duplicate commit SHAs (commits that exist in both fork and parent)
            const duplicateShas = await db.execute(sql`
                SELECT DISTINCT fc.sha
                FROM commits fc
                INNER JOIN commits pc ON fc.sha = pc.sha
                WHERE fc.repository_id = ${fork.id}
                  AND pc.repository_id = ${fork.parentRepositoryId}
            `);

            // @ts-ignore - rows property exists
            const shas = (duplicateShas.rows || duplicateShas).map((row: any) => row.sha);

            if (shas.length === 0) {
                console.log('   ✅ No duplicates found');
                console.log('');
                continue;
            }

            console.log(`   Found ${shas.length} duplicate commit(s)`);

            // Delete duplicate commits from fork in batches
            const batchSize = 1000;
            let deletedCount = 0;

            for (let i = 0; i < shas.length; i += batchSize) {
                const batch = shas.slice(i, i + batchSize);
                const result = await db
                    .delete(commits)
                    .where(and(
                        eq(commits.repositoryId, fork.id),
                        inArray(commits.sha, batch)
                    ));

                // @ts-ignore - rowCount exists on result
                const rowCount = result.rowCount || 0;
                deletedCount += rowCount;

                if (i % 5000 === 0 && i > 0) {
                    console.log(`   Processed ${i}/${shas.length} commits...`);
                }
            }

            totalDuplicatesRemoved += deletedCount;

            // Count commits in fork after cleanup
            const [forkCommitCountAfter] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(commits)
                .where(eq(commits.repositoryId, fork.id));

            console.log(`   ✅ Removed ${deletedCount} duplicate commits`);
            console.log(`   Fork commits after: ${forkCommitCountAfter.count}`);
            console.log('');
        }

        console.log('═'.repeat(60));
        console.log('✅ Fork attribution fix completed!');
        console.log(`   Total duplicates removed: ${totalDuplicatesRemoved.toLocaleString()}`);
        console.log('═'.repeat(60));

    } catch (error: any) {
        console.error('❌ Error during fork attribution fix:');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

fixForkAttribution();
