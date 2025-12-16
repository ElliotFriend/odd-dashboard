import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/lib/server/db';
import { repositories, commits } from '../src/lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkAttribution() {
    console.log('🔍 Checking stellar-core repository attribution...\n');

    // Get all stellar-core repos
    const repos = await db
        .select({
            id: repositories.id,
            fullName: repositories.fullName,
            isFork: repositories.isFork,
            parentRepositoryId: repositories.parentRepositoryId,
            parentFullName: repositories.parentFullName,
        })
        .from(repositories)
        .where(sql`${repositories.fullName} ILIKE '%stellar-core'`)
        .orderBy(repositories.fullName);

    console.log(`Found ${repos.length} stellar-core repositories:\n`);

    for (const repo of repos) {
        // Count commits for this repo
        const [commitCount] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(commits)
            .where(eq(commits.repositoryId, repo.id));

        console.log(`📦 ${repo.fullName} (ID: ${repo.id})`);
        console.log(`   Is fork: ${repo.isFork}`);
        console.log(`   Parent: ${repo.parentFullName || 'N/A'}`);
        console.log(`   Parent ID: ${repo.parentRepositoryId || 'NULL'}`);
        console.log(`   Commits: ${commitCount.count.toLocaleString()}`);
        console.log('');
    }

    // Check for the specific case mentioned
    const graydon = repos.find(r => r.fullName === 'graydon/stellar-core');
    const stellar = repos.find(r => r.fullName === 'stellar/stellar-core');

    if (graydon && stellar) {
        console.log('🔍 Checking for duplicate commits between fork and parent...\n');

        // Check for commits that exist in both
        const duplicates = await db.execute(sql`
            SELECT COUNT(*) as duplicate_count
            FROM commits fc
            INNER JOIN commits pc ON fc.sha = pc.sha
            WHERE fc.repository_id = ${graydon.id}
              AND pc.repository_id = ${stellar.id}
        `);

        // @ts-ignore
        const dupCount = (duplicates.rows || duplicates)[0].duplicate_count;

        console.log(`Duplicate commits (same SHA in both repos): ${dupCount}`);
        console.log('');

        if (dupCount > 0) {
            console.log('✅ The fix-fork-attribution.ts script can clean this up!');
            console.log('   It will remove duplicates from the fork, keeping them in the parent.');
            console.log('');
            console.log('   Run: pnpm tsx scripts/fix-fork-attribution.ts');
        } else {
            console.log('⚠️  No duplicates found. The commits may need to be:');
            console.log('   1. Synced to the parent repository first');
            console.log('   2. Or moved from fork to parent if parent is already synced');
        }
    }
}

checkAttribution();
