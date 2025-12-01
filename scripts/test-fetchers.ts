import { getRepository, getCommits, getUserByUsername, getUserById } from '../src/lib/server/github/fetchers';
import dotenv from 'dotenv';

dotenv.config();

async function testFetchers() {
    console.log('Testing GitHub Fetchers...');

    try {
        // 1. Test getRepository
        console.log('\n1. Testing getRepository(sveltejs, kit)...');
        const repo = await getRepository('sveltejs', 'kit');
        console.log(`✅ Found repo: ${repo.full_name}`);
        console.log(`   Default branch: ${repo.default_branch}`);
        console.log(`   Stars: ${repo.stargazers_count}`);

        // 2. Test getCommits
        console.log('\n2. Testing getCommits(sveltejs, kit)...');
        const commits = await getCommits('sveltejs', 'kit', repo.default_branch, undefined, 1, 5);
        console.log(`✅ Fetched ${commits.length} commits`);
        console.log(`   Latest commit: ${commits[0].sha.substring(0, 7)} - ${commits[0].commit.message.split('\n')[0]}`);

        // 3. Test getUserByUsername
        console.log('\n3. Testing getUserByUsername(Rich-Harris)...');
        const user = await getUserByUsername('Rich-Harris');
        console.log(`✅ Found user: ${user.login}`);
        console.log(`   ID: ${user.id}`);

        // 4. Test getUserById
        console.log(`\n4. Testing getUserById(${user.id})...`);
        const userById = await getUserById(user.id);
        console.log(`✅ Found user by ID: ${userById.login}`);

    } catch (error: any) {
        console.error('❌ Error testing fetchers:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
        }
        process.exit(1);
    }
}

testFetchers();
