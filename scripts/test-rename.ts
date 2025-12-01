import { db } from '../src/lib/server/db';
import { repositories } from '../src/lib/server/db/schema';
import { checkAndUpdateRepositoryName } from '../src/lib/server/services/repository-rename.service';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function testRenameDetection() {
    console.log('Testing Repository Rename Detection...');

    try {
        // 1. Setup: Insert a "fake" repository with an old name
        // We'll use "sveltejs/kit" but call it "sveltejs/old-kit-name"
        const oldName = 'sveltejs/old-kit-name';
        const realName = 'sveltejs/kit';
        const githubId = 123456789; // Fake ID for test, but needs to be unique if we had constraints checked against real GitHub

        // Check if it exists first to clean up
        await db.delete(repositories).where(eq(repositories.fullName, oldName));
        await db.delete(repositories).where(eq(repositories.fullName, realName));

        console.log(`\n1. Inserting test repo with old name: ${oldName}`);
        const [insertedRepo] = await db.insert(repositories).values({
            githubId: 33503666, // Real ID for sveltejs/kit
            fullName: oldName,
            defaultBranch: 'master', // Intentionally wrong to see if we update it later (though this service only updates name)
        }).returning();

        console.log(`   Inserted ID: ${insertedRepo.id}`);

        // 2. Run the rename check
        console.log(`\n2. Running checkAndUpdateRepositoryName for ID ${insertedRepo.id}...`);
        // Note: We pass the *old* name. The function will fetch from GitHub using "sveltejs/kit" 
        // WAIT. The function logic I wrote splits the *current* stored name.
        // If I stored "sveltejs/old-kit-name", and I ask GitHub for "sveltejs/old-kit-name", 
        // GitHub will return 404 if that repo never existed.
        // Rename detection relies on GitHub redirecting requests for the *old* name to the *new* name.
        // So I need to use a REAL rename case for this to work 100% "live".
        // OR I can mock the fetcher.

        // Let's try a real rename case if I can think of one.
        // "google/traceur-compiler" -> "google/traceur-compiler" (wait, that's not renamed)
        // "sebmck/2048-react" -> "facebook/2048-react" (maybe?)

        // Actually, for this test, let's just use the REAL name in the DB, but modify the function call 
        // to simulate "what if the DB had an old name".
        // BUT the function uses the DB name to query GitHub.

        // Strategy: We will use a REAL repo that was renamed.
        // "now" -> "vercel" (cli)
        // "zeit/next.js" -> "vercel/next.js"

        const oldRealName = 'zeit/next.js';
        const newRealName = 'vercel/next.js';

        // Let's update our test data to use this
        await db.delete(repositories).where(eq(repositories.id, insertedRepo.id));

        const [repoToTest] = await db.insert(repositories).values({
            githubId: 70107786, // ID for next.js
            fullName: oldRealName,
            defaultBranch: 'canary',
        }).returning();

        console.log(`   Re-inserted repo with KNOWN OLD name: ${oldRealName}`);

        const result = await checkAndUpdateRepositoryName(repoToTest.id, oldRealName);

        // 3. Verify results
        console.log('\n3. Result:', result);

        if (result.renamed && result.newFullName === newRealName) {
            console.log('✅ SUCCESS: Rename detected and returned correctly.');
        } else {
            console.error('❌ FAILURE: Rename not detected or incorrect name.');
        }

        // 4. Verify DB update
        const updatedRepo = await db.query.repositories.findFirst({
            where: eq(repositories.id, repoToTest.id),
        });

        console.log(`\n4. DB State: ${updatedRepo?.fullName}`);
        if (updatedRepo?.fullName === newRealName) {
            console.log('✅ SUCCESS: Database updated.');
        } else {
            console.error('❌ FAILURE: Database not updated.');
        }

        // Cleanup
        await db.delete(repositories).where(eq(repositories.id, repoToTest.id));

    } catch (error: any) {
        console.error('❌ Error testing rename detection:', error);
        process.exit(1);
    }
}

testRenameDetection();
