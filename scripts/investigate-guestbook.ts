import "dotenv/config";
import { db } from "../src/lib/server/db/index.js";
import { sql } from "drizzle-orm";
import { getRepository } from "../src/lib/server/github/fetchers.js";
import { createOrUpdateRepositoryFromGitHub } from "../src/lib/server/services/repository.service.js";
import { syncRepositoryCommits } from "../src/lib/server/services/sync.service.js";

async function investigate() {
    console.log("🔍 Investigating ye-olde-guestbook...\n");

    // Check what's in the database
    console.log("1. Checking database for guestbook repositories:");
    const repos = await db.execute(
        sql`SELECT id, full_name, github_id, is_fork, default_branch, last_synced_at
            FROM repositories
            WHERE full_name ILIKE '%guestbook%'`,
    );

    console.log(`   Found ${(repos as any[]).length} repositories:`);
    for (const repo of repos as any[]) {
        console.log(`   - ID: ${repo.id}, Name: ${repo.full_name}, GitHub ID: ${repo.github_id}`);
        console.log(`     Branch: ${repo.default_branch}, Last Synced: ${repo.last_synced_at}`);
    }

    // Try fetching with correct capitalization
    console.log("\n2. Trying to fetch with correct case (ElliotFriend/ye-olde-guestbook):");
    try {
        const [owner, repo] = ["ElliotFriend", "ye-olde-guestbook"];
        const githubRepo = await getRepository(owner, repo);
        console.log(`   ✅ Found: ${githubRepo.full_name}`);
        console.log(`   - GitHub ID: ${githubRepo.id}`);
        console.log(`   - Default Branch: ${githubRepo.default_branch}`);
        console.log(`   - Fork: ${githubRepo.fork}`);

        // Check if it's in database
        const existingRepo = await db.execute(
            sql`SELECT * FROM repositories WHERE github_id = ${githubRepo.id}`,
        );

        if ((existingRepo as any[]).length > 0) {
            const dbRepo = (existingRepo as any[])[0];
            console.log(`   ✅ Repository exists in database with ID: ${dbRepo.id}`);
            console.log(`   - Stored as: ${dbRepo.full_name}`);

            // Check commits
            const commits = await db.execute(
                sql`SELECT COUNT(*) as count FROM commits WHERE repository_id = ${dbRepo.id}`,
            );
            console.log(`   - Commits in DB: ${(commits as any[])[0].count}`);

            // If no commits, try syncing
            if ((commits as any[])[0].count === "0") {
                console.log("\n3. No commits found. Attempting to sync...");
                const result = await syncRepositoryCommits(dbRepo.id, {
                    initialSync: true,
                    batchSize: 100,
                });

                console.log(`   Sync Results:`);
                console.log(`   - Processed: ${result.commitsProcessed}`);
                console.log(`   - Created: ${result.commitsCreated}`);
                console.log(`   - Skipped: ${result.commitsSkipped}`);
                console.log(`   - Authors Created: ${result.authorsCreated}`);
                console.log(`   - Errors: ${result.errors.length}`);

                if (result.errors.length > 0) {
                    console.log(`\n   Errors encountered:`);
                    result.errors.slice(0, 5).forEach((err, idx) => {
                        console.log(`   ${idx + 1}. ${err}`);
                    });
                }
            }
        } else {
            console.log(`   ⚠️  Repository NOT in database. Creating...`);
            const result = await createOrUpdateRepositoryFromGitHub(githubRepo, {
                detectFork: true,
            });
            console.log(`   ✅ Created with ID: ${result.repository.id}`);

            // Try syncing
            console.log("\n3. Attempting to sync commits...");
            const syncResult = await syncRepositoryCommits(result.repository.id, {
                initialSync: true,
                batchSize: 100,
            });

            console.log(`   Sync Results:`);
            console.log(`   - Processed: ${syncResult.commitsProcessed}`);
            console.log(`   - Created: ${syncResult.commitsCreated}`);
            console.log(`   - Skipped: ${syncResult.commitsSkipped}`);
            console.log(`   - Authors Created: ${syncResult.authorsCreated}`);
            console.log(`   - Errors: ${syncResult.errors.length}`);
        }
    } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Final stats
    console.log("\n4. Final repository stats:");
    const finalRepos = await db.execute(
        sql`SELECT
                r.id,
                r.full_name,
                COUNT(DISTINCT c.id) as commit_count,
                COUNT(DISTINCT c.author_id) as author_count
            FROM repositories r
            LEFT JOIN commits c ON r.id = c.repository_id
            WHERE r.full_name ILIKE '%guestbook%'
            GROUP BY r.id, r.full_name`,
    );

    for (const repo of finalRepos as any[]) {
        console.log(`   - ${repo.full_name}: ${repo.commit_count} commits, ${repo.author_count} authors`);
    }
}

investigate()
    .then(() => {
        console.log("\n✅ Investigation complete");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Fatal error:", error);
        process.exit(1);
    });
