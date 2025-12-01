import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getCommits, extractAuthorFromCommit } from '../src/lib/server/github/fetchers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Test script to verify author extraction from commits works for both GitHub users and email-only commits.
 * 
 * Usage:
 *   pnpm tsx scripts/test-author-extraction.ts <owner> <repo> [branch] [limit]
 * 
 * Example:
 *   pnpm tsx scripts/test-author-extraction.ts octocat Hello-World main 10
 */
async function testAuthorExtraction() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: pnpm tsx scripts/test-author-extraction.ts <owner> <repo> [branch] [limit]');
        console.error('Example: pnpm tsx scripts/test-author-extraction.ts octocat Hello-World main 10');
        process.exit(1);
    }

    const owner = args[0];
    const repo = args[1];
    const branch = args[2] || 'main';
    const limit = args[3] ? parseInt(args[3], 10) : 10;

    if (isNaN(limit) || limit < 1) {
        console.error('Error: limit must be a positive number');
        process.exit(1);
    }

    console.log(`🔍 Testing author extraction for repository:`);
    console.log(`   Owner: ${owner}`);
    console.log(`   Repo: ${repo}`);
    console.log(`   Branch: ${branch}`);
    console.log(`   Limit: ${limit} commits`);
    console.log('');

    try {
        const commits = await getCommits(owner, repo, branch, undefined, 1, limit);

        if (commits.length === 0) {
            console.log('ℹ️  No commits found in this repository');
            return;
        }

        console.log(`📊 Found ${commits.length} commit(s)\n`);

        let githubUserCount = 0;
        let emailOnlyCount = 0;

        commits.forEach((commit, index) => {
            const authorInfo = extractAuthorFromCommit(commit);
            const isGitHubUser = authorInfo.githubId !== null;

            if (isGitHubUser) {
                githubUserCount++;
            } else {
                emailOnlyCount++;
            }

            console.log(`Commit ${index + 1}: ${commit.sha.substring(0, 7)}`);
            console.log(`  Name: ${authorInfo.name}`);
            console.log(`  Email: ${authorInfo.email}`);
            if (authorInfo.githubId) {
                console.log(`  GitHub ID: ${authorInfo.githubId}`);
                console.log(`  Username: ${authorInfo.username}`);
                console.log(`  Type: ✅ GitHub User`);
            } else {
                console.log(`  Type: 📧 Email-only (no GitHub account)`);
            }
            console.log('');
        });

        console.log('📈 Summary:');
        console.log(`   GitHub Users: ${githubUserCount}`);
        console.log(`   Email-only: ${emailOnlyCount}`);
        console.log(`   Total: ${commits.length}`);
    } catch (error: any) {
        console.error('❌ Error during author extraction:');
        console.error(error.message);
        process.exit(1);
    }
}

testAuthorExtraction();

