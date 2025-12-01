import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { detectRepositoryRename } from '../src/lib/server/github/fetchers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Test script to verify repository rename detection works.
 * 
 * Usage:
 *   pnpm tsx scripts/test-rename-detection.ts <github_id> <stored_full_name>
 * 
 * Example:
 *   pnpm tsx scripts/test-rename-detection.ts 12345678 "owner/old-repo-name"
 */
async function testRenameDetection() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: pnpm tsx scripts/test-rename-detection.ts <github_id> <stored_full_name>');
        console.error('Example: pnpm tsx scripts/test-rename-detection.ts 12345678 "owner/old-repo-name"');
        process.exit(1);
    }

    const githubId = parseInt(args[0], 10);
    const storedFullName = args[1];

    if (isNaN(githubId)) {
        console.error('Error: github_id must be a number');
        process.exit(1);
    }

    console.log(`🔍 Testing rename detection for repository:`);
    console.log(`   GitHub ID: ${githubId}`);
    console.log(`   Stored full_name: ${storedFullName}`);
    console.log('');

    try {
        const result = await detectRepositoryRename(storedFullName, githubId);

        if (result.isRenamed) {
            console.log('✅ Rename detected!');
            console.log(`   Old name: ${result.oldFullName}`);
            console.log(`   New name: ${result.newFullName}`);
        } else {
            console.log('ℹ️  No rename detected - repository name matches stored value');
            console.log(`   Current name: ${result.oldFullName}`);
        }
    } catch (error: any) {
        console.error('❌ Error during rename detection:');
        console.error(error.message);
        process.exit(1);
    }
}

testRenameDetection();

