import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/lib/server/db';
import { repositories } from '../src/lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { linkForkToParent } from '../src/lib/server/services/fork-detection.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Link fork repositories to their parent repositories.
 *
 * This script finds all forks that have a parent_full_name but no parent_repository_id,
 * checks if the parent exists in the database, and links them if found.
 *
 * This is particularly useful after bulk imports where forks and their parents are
 * both imported but not yet linked to each other.
 *
 * Usage:
 *   pnpm tsx scripts/link-fork-parents.ts
 *
 * Options:
 *   --dry-run    Show what would be linked without making changes
 */
async function linkForkParents() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log('🔗 Starting fork-parent linking process...');
    if (isDryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
    }
    console.log('');

    try {
        // Find all forks that need linking
        // (forks with parent_full_name but no parent_repository_id)
        const unlinkedForks = await db
            .select({
                id: repositories.id,
                fullName: repositories.fullName,
                parentFullName: repositories.parentFullName,
                parentRepositoryId: repositories.parentRepositoryId,
            })
            .from(repositories)
            .where(
                and(
                    eq(repositories.isFork, true),
                    sql`${repositories.parentFullName} IS NOT NULL`,
                    sql`${repositories.parentRepositoryId} IS NULL`
                )
            );

        if (unlinkedForks.length === 0) {
            console.log('✅ No unlinked forks found. All forks are already linked or have no parent info.');
            return;
        }

        console.log(`📊 Found ${unlinkedForks.length} unlinked fork(s):`);
        console.log('');

        let linkedCount = 0;
        let notFoundCount = 0;
        const linkedPairs: Array<{ fork: string; parent: string }> = [];
        const notFoundPairs: Array<{ fork: string; parent: string }> = [];

        // Process each unlinked fork
        for (const fork of unlinkedForks) {
            if (!fork.parentFullName) {
                continue;
            }

            // Check if parent exists in database
            const [parent] = await db
                .select({ id: repositories.id })
                .from(repositories)
                .where(eq(repositories.fullName, fork.parentFullName))
                .limit(1);

            if (parent) {
                console.log(`✅ ${fork.fullName}`);
                console.log(`   → ${fork.parentFullName} (ID: ${parent.id})`);

                linkedPairs.push({ fork: fork.fullName, parent: fork.parentFullName });

                if (!isDryRun) {
                    // Link the fork to parent
                    await linkForkToParent(fork.id, fork.parentFullName);
                }

                linkedCount++;
            } else {
                console.log(`⚠️  ${fork.fullName}`);
                console.log(`   → ${fork.parentFullName} (NOT FOUND in database)`);

                notFoundPairs.push({ fork: fork.fullName, parent: fork.parentFullName });
                notFoundCount++;
            }
            console.log('');
        }

        // Summary
        console.log('═'.repeat(70));
        console.log('📊 Summary:');
        console.log('═'.repeat(70));
        console.log(`Total forks processed: ${unlinkedForks.length}`);
        console.log(`Successfully linked: ${linkedCount}`);
        console.log(`Parents not found: ${notFoundCount}`);
        console.log('');

        if (linkedCount > 0) {
            if (isDryRun) {
                console.log('✅ DRY RUN: Would link the following fork-parent pairs:');
            } else {
                console.log('✅ Successfully linked fork-parent pairs:');
            }
            linkedPairs.forEach(({ fork, parent }) => {
                console.log(`   ${fork} → ${parent}`);
            });
            console.log('');
        }

        if (notFoundCount > 0) {
            console.log('⚠️  Parents not found in database:');
            notFoundPairs.forEach(({ fork, parent }) => {
                console.log(`   ${fork} → ${parent}`);
            });
            console.log('');
            console.log('💡 Tip: Import the parent repositories to enable linking:');
            notFoundPairs.slice(0, 3).forEach(({ parent }) => {
                console.log(`   pnpm tsx scripts/add-test-repository.ts ${parent}`);
            });
            if (notFoundPairs.length > 3) {
                console.log(`   ... and ${notFoundPairs.length - 3} more`);
            }
            console.log('');
        }

        console.log('═'.repeat(70));
        if (isDryRun) {
            console.log('🔍 DRY RUN completed - run without --dry-run to apply changes');
        } else {
            console.log('✅ Fork-parent linking completed!');
        }
        console.log('═'.repeat(70));
    } catch (error: any) {
        console.error('❌ Error during fork-parent linking:');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

linkForkParents();
