import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../src/lib/server/db';
import { repositories } from '../src/lib/server/db/schema';
import { getRepository } from '../src/lib/server/github/fetchers';
import { detectAndLinkFork } from '../src/lib/server/services/fork-detection.service';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Test fork detection and linking.
 * 
 * Usage:
 *   pnpm tsx scripts/test-fork-detection.ts <owner> <repo>
 * 
 * Example:
 *   pnpm tsx scripts/test-fork-detection.ts octocat Hello-World
 */
async function testForkDetection() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: pnpm tsx scripts/test-fork-detection.ts <owner> <repo>');
        console.error('Example: pnpm tsx scripts/test-fork-detection.ts octocat Hello-World');
        process.exit(1);
    }

    const owner = args[0];
    const repo = args[1];
    const fullName = `${owner}/${repo}`;

    console.log(`🔍 Testing fork detection for repository:`);
    console.log(`   Full name: ${fullName}`);
    console.log('');

    try {
        // Fetch repository from GitHub
        console.log('📡 Fetching repository data from GitHub...');
        const githubRepo = await getRepository(owner, repo);
        console.log(`   ✅ Fetched: ${githubRepo.full_name}`);
        console.log(`   GitHub ID: ${githubRepo.id}`);
        console.log(`   Is fork: ${githubRepo.fork || false}`);
        if (githubRepo.parent) {
            console.log(`   Parent: ${githubRepo.parent.full_name}`);
        }
        console.log('');

        // Check if repository exists in database
        const existing = await db
            .select()
            .from(repositories)
            .where(eq(repositories.githubId, githubRepo.id))
            .limit(1);

        let repositoryId: number;

        if (existing.length > 0) {
            repositoryId = existing[0].id;
            console.log(`📦 Repository found in database (ID: ${repositoryId})`);
        } else {
            // Create repository first
            console.log('➕ Repository not found, creating...');
            const [newRepo] = await db
                .insert(repositories)
                .values({
                    githubId: githubRepo.id,
                    fullName: githubRepo.full_name,
                    defaultBranch: githubRepo.default_branch,
                    isFork: githubRepo.fork || false,
                    parentFullName: githubRepo.parent?.full_name || null,
                })
                .returning({ id: repositories.id });

            repositoryId = newRepo.id;
            console.log(`   ✅ Created repository ID: ${repositoryId}`);
        }

        console.log('');
        console.log('🔗 Testing fork detection and linking...');
        const result = await detectAndLinkFork(repositoryId, githubRepo);

        console.log('');
        console.log('✅ Fork detection results:');
        console.log(`   Is fork: ${result.isFork}`);
        console.log(`   Parent full name: ${result.parentFullName || 'N/A'}`);
        console.log(`   Parent repository ID: ${result.parentRepositoryId || 'N/A'}`);
        console.log(`   Parent linked: ${result.parentLinked ? '✅ Yes' : '❌ No'}`);

        if (result.isFork && result.parentFullName && !result.parentLinked) {
            console.log('');
            console.log('💡 Tip: To test parent linking, add the parent repository first:');
            console.log(`   pnpm tsx scripts/add-test-repository.ts ${result.parentFullName}`);
        }

        // Show repository details from database
        const [dbRepo] = await db
            .select()
            .from(repositories)
            .where(eq(repositories.id, repositoryId))
            .limit(1);

        if (dbRepo) {
            console.log('');
            console.log('📊 Database record:');
            console.log(`   is_fork: ${dbRepo.isFork}`);
            console.log(`   parent_full_name: ${dbRepo.parentFullName || 'NULL'}`);
            console.log(`   parent_repository_id: ${dbRepo.parentRepositoryId || 'NULL'}`);
        }
    } catch (error: any) {
        console.error('❌ Error during fork detection:');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

testForkDetection();

