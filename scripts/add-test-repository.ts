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
 * Add a repository to the database for testing.
 * Fetches repository data from GitHub and creates/updates the database record.
 * 
 * Usage:
 *   pnpm tsx scripts/add-test-repository.ts <owner> <repo>
 * 
 * Example:
 *   pnpm tsx scripts/add-test-repository.ts octocat Hello-World
 */
async function addTestRepository() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: pnpm tsx scripts/add-test-repository.ts <owner> <repo>');
        console.error('Example: pnpm tsx scripts/add-test-repository.ts octocat Hello-World');
        process.exit(1);
    }

    const owner = args[0];
    const repo = args[1];
    const fullName = `${owner}/${repo}`;

    console.log(`🔍 Adding repository to database:`);
    console.log(`   Full name: ${fullName}`);
    console.log('');

    try {
        // Fetch repository from GitHub
        console.log('📡 Fetching repository data from GitHub...');
        const githubRepo = await getRepository(owner, repo);
        console.log(`   ✅ Fetched: ${githubRepo.full_name}`);
        console.log(`   GitHub ID: ${githubRepo.id}`);
        console.log(`   Default branch: ${githubRepo.default_branch}`);
        console.log(`   Is fork: ${githubRepo.fork || false}`);
        if (githubRepo.parent) {
            console.log(`   Parent: ${githubRepo.parent.full_name}`);
        }
        console.log('');

        // Check if repository already exists
        const existing = await db
            .select()
            .from(repositories)
            .where(eq(repositories.githubId, githubRepo.id))
            .limit(1);

        let repositoryId: number;

        if (existing.length > 0) {
            // Update existing repository
            console.log('🔄 Repository already exists, updating...');
            await db
                .update(repositories)
                .set({
                    fullName: githubRepo.full_name,
                    defaultBranch: githubRepo.default_branch,
                    isFork: githubRepo.fork || false,
                    parentFullName: githubRepo.parent?.full_name || null,
                })
                .where(eq(repositories.id, existing[0].id));

            repositoryId = existing[0].id;
            console.log(`   ✅ Updated repository ID: ${repositoryId}`);
        } else {
            // Create new repository
            console.log('➕ Creating new repository...');
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

        // Detect and link fork if applicable
        if (githubRepo.fork) {
            console.log('');
            console.log('🔗 Detecting and linking fork...');
            const forkResult = await detectAndLinkFork(repositoryId, githubRepo);
            console.log(`   Is fork: ${forkResult.isFork}`);
            console.log(`   Parent full name: ${forkResult.parentFullName || 'N/A'}`);
            if (forkResult.parentLinked) {
                console.log(`   ✅ Linked to parent repository ID: ${forkResult.parentRepositoryId}`);
            } else if (forkResult.parentFullName) {
                console.log(`   ⚠️  Parent repository not found in database: ${forkResult.parentFullName}`);
            }
        }

        console.log('');
        console.log('✅ Repository added/updated successfully!');
        console.log(`   Repository ID: ${repositoryId}`);
        console.log(`   You can now test sync with: pnpm tsx scripts/test-sync.ts ${repositoryId}`);
    } catch (error: any) {
        console.error('❌ Error adding repository:');
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

addTestRepository();

