import "dotenv/config";
import { db } from "../src/lib/server/db/index.js";
import { getRepository } from "../src/lib/server/github/fetchers.js";
import { createOrUpdateRepositoryFromGitHub } from "../src/lib/server/services/repository.service.js";
import { syncRepositoryCommits } from "../src/lib/server/services/sync.service.js";
import { sql } from "drizzle-orm";

/**
 * GitHub Integration Testing Script
 *
 * Tests repository fetching, commit syncing, fork detection, and author management
 */

interface TestResult {
    name: string;
    passed: boolean;
    message?: string;
    data?: any;
}

const results: TestResult[] = [];

// Test repositories
const TEST_REPOS = [
    { fullName: "stellar/stellar-core", type: "main" },
    { fullName: "stellar/stellar-protocol", type: "main" },
    { fullName: "elliotfriend/ye-olde-guestbook", type: "small" },
    { fullName: "sisuresh/stellar-quorum-analyzer", type: "fork" },
];

async function checkGitHubToken() {
    console.log("\n🔑 Checking GitHub Token...\n");

    const token = process.env.GITHUB_TOKEN;

    results.push({
        name: "GitHub Token: Environment variable set",
        passed: !!token,
        message: token
            ? `Token found (${token.substring(0, 10)}...)`
            : "GITHUB_TOKEN not set in environment",
    });

    return !!token;
}

async function testRepositoryFetch(fullName: string) {
    console.log(`\n📦 Fetching repository: ${fullName}...`);

    try {
        const [owner, repo] = fullName.split("/");
        if (!owner || !repo) {
            throw new Error(`Invalid repository name: ${fullName}`);
        }

        const repoData = await getRepository(owner, repo);

        results.push({
            name: `Repository Fetch: ${fullName}`,
            passed: !!repoData,
            message: repoData
                ? `Found: ${repoData.full_name} (${repoData.default_branch}, fork: ${repoData.fork})`
                : undefined,
            data: repoData,
        });

        return repoData;
    } catch (error) {
        results.push({
            name: `Repository Fetch: ${fullName}`,
            passed: false,
            message:
                error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

async function testRepositoryCreate(fullName: string, githubRepo: any) {
    console.log(`\n💾 Creating repository in database: ${fullName}...`);

    try {
        const result = await createOrUpdateRepositoryFromGitHub(githubRepo, {
            detectFork: true,
            detectRename: true,
        });

        const dbRepo = result.repository;

        results.push({
            name: `Repository Create: ${fullName}`,
            passed: !!dbRepo,
            message: dbRepo
                ? `${result.created ? "Created" : "Updated"} ID: ${dbRepo.id}, Fork: ${dbRepo.isFork}, Parent: ${dbRepo.parentFullName || "none"}`
                : undefined,
            data: dbRepo,
        });

        return dbRepo;
    } catch (error) {
        results.push({
            name: `Repository Create: ${fullName}`,
            passed: false,
            message:
                error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

async function testCommitSync(
    repositoryId: number,
    fullName: string,
    limitCommits: number = 100,
) {
    console.log(
        `\n🔄 Syncing commits for ${fullName} (limit: ${limitCommits})...`,
    );

    try {
        const result = await syncRepositoryCommits(repositoryId, {
            initialSync: true,
            batchSize: 100,
            maxCommits: limitCommits, // Limit for testing
        });

        const success =
            result.commitsProcessed > 0 || result.errors.length === 0;

        results.push({
            name: `Commit Sync: ${fullName}`,
            passed: success,
            message: `Processed: ${result.commitsProcessed}, Created: ${result.commitsCreated}, Skipped: ${result.commitsSkipped}, Authors: ${result.authorsCreated}, Errors: ${result.errors.length}`,
            data: result,
        });

        if (result.errors.length > 0) {
            console.log(`   ⚠️  Errors encountered:`);
            result.errors.forEach((err, idx) => {
                console.log(`      ${idx + 1}. ${err}`);
            });
        }

        return result;
    } catch (error) {
        results.push({
            name: `Commit Sync: ${fullName}`,
            passed: false,
            message:
                error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

async function testForkDetection(fullName: string) {
    console.log(`\n🔱 Testing fork detection for: ${fullName}...`);

    try {
        const repo = await db.execute(
            sql`SELECT id, full_name, is_fork, parent_full_name, parent_repository_id
                FROM repositories
                WHERE full_name = ${fullName}`,
        );

        const repoData = (repo as any[])[0];

        if (!repoData) {
            results.push({
                name: `Fork Detection: ${fullName}`,
                passed: false,
                message: "Repository not found in database",
            });
            return null;
        }

        const isFork = repoData.is_fork;
        const parentFullName = repoData.parent_full_name;
        const parentId = repoData.parent_repository_id;

        results.push({
            name: `Fork Detection: ${fullName}`,
            passed: true,
            message: isFork
                ? `Detected as fork of ${parentFullName} (parent ID: ${parentId || "not in DB"})`
                : "Not a fork",
            data: { isFork, parentFullName, parentId },
        });

        return { isFork, parentFullName, parentId };
    } catch (error) {
        results.push({
            name: `Fork Detection: ${fullName}`,
            passed: false,
            message:
                error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

async function getRepositoryStats(fullName: string) {
    console.log(`\n📊 Getting stats for: ${fullName}...`);

    try {
        const stats = await db.execute(
            sql`SELECT
                    r.id,
                    r.full_name,
                    COUNT(DISTINCT c.id) as commit_count,
                    COUNT(DISTINCT c.author_id) as author_count,
                    MIN(c.commit_date) as earliest_commit,
                    MAX(c.commit_date) as latest_commit
                FROM repositories r
                LEFT JOIN commits c ON r.id = c.repository_id
                WHERE r.full_name = ${fullName}
                GROUP BY r.id, r.full_name`,
        );

        const statsData = (stats as any[])[0];

        if (statsData) {
            console.log(`   Commits: ${statsData.commit_count}`);
            console.log(`   Authors: ${statsData.author_count}`);
            console.log(
                `   Date Range: ${statsData.earliest_commit || "N/A"} to ${statsData.latest_commit || "N/A"}`,
            );
        }

        return statsData;
    } catch (error) {
        console.error(`   Error getting stats: ${error}`);
        return null;
    }
}

async function testAuthorDeduplication() {
    console.log(`\n👥 Testing author deduplication...`);

    try {
        const authors = await db.execute(
            sql`SELECT
                    COUNT(*) as total_authors,
                    COUNT(DISTINCT github_id) as unique_github_ids,
                    COUNT(DISTINCT email) as unique_emails,
                    SUM(CASE WHEN github_id IS NULL THEN 1 ELSE 0 END) as email_only_authors
                FROM authors`,
        );

        const authorStats = (authors as any[])[0];

        results.push({
            name: "Author Deduplication: Statistics",
            passed: true,
            message: `Total: ${authorStats.total_authors}, GitHub IDs: ${authorStats.unique_github_ids}, Email-only: ${authorStats.email_only_authors}`,
            data: authorStats,
        });

        return authorStats;
    } catch (error) {
        results.push({
            name: "Author Deduplication: Statistics",
            passed: false,
            message:
                error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

async function printResults() {
    console.log("\n" + "=".repeat(80));
    console.log("GITHUB INTEGRATION TEST RESULTS");
    console.log("=".repeat(80) + "\n");

    const passed = results.filter((r) => r.passed);
    const failed = results.filter((r) => !r.passed);

    console.log(`✅ Passed: ${passed.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Total:  ${results.length}\n`);

    if (failed.length > 0) {
        console.log("Failed Tests:");
        console.log("-".repeat(80));
        for (const result of failed) {
            console.log(`❌ ${result.name}`);
            if (result.message) {
                console.log(`   ${result.message}`);
            }
        }
        console.log();
    }

    console.log("=".repeat(80) + "\n");

    return failed.length === 0;
}

async function main() {
    console.log("=".repeat(80));
    console.log("GitHub Integration Testing");
    console.log("=".repeat(80));

    // Check GitHub token
    const hasToken = await checkGitHubToken();
    if (!hasToken) {
        console.error("❌ GITHUB_TOKEN not set. Exiting.");
        process.exit(1);
    }

    console.log("\n" + "=".repeat(80));
    console.log("PHASE 1: Repository Fetching");
    console.log("=".repeat(80));

    // Fetch all repositories from GitHub API
    const repoData: any[] = [];
    for (const testRepo of TEST_REPOS) {
        const repo = await testRepositoryFetch(testRepo.fullName);
        if (repo) {
            repoData.push({ ...testRepo, githubData: repo });
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("PHASE 2: Repository Creation");
    console.log("=".repeat(80));

    // Create repositories in database using the fetched GitHub data
    const dbRepos: any[] = [];
    for (const testRepo of repoData) {
        if (testRepo.githubData) {
            const dbRepo = await testRepositoryCreate(
                testRepo.fullName,
                testRepo.githubData,
            );
            if (dbRepo) {
                dbRepos.push({ ...testRepo, dbData: dbRepo });
            }
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("PHASE 3: Fork Detection");
    console.log("=".repeat(80));

    // Test fork detection
    for (const testRepo of TEST_REPOS) {
        await testForkDetection(testRepo.fullName);
    }

    console.log("\n" + "=".repeat(80));
    console.log("PHASE 4: Commit Syncing");
    console.log("=".repeat(80));

    // Sync commits (limit to 100 commits per repo for testing)
    for (const dbRepo of dbRepos) {
        if (dbRepo.dbData) {
            await testCommitSync(
                dbRepo.dbData.id,
                dbRepo.fullName,
                dbRepo.type === "small" ? 1000 : 100, // More commits for small repo
            );
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("PHASE 5: Repository Statistics");
    console.log("=".repeat(80));

    // Get stats for each repository
    for (const testRepo of TEST_REPOS) {
        await getRepositoryStats(testRepo.fullName);
    }

    console.log("\n" + "=".repeat(80));
    console.log("PHASE 6: Author Deduplication");
    console.log("=".repeat(80));

    // Test author deduplication
    await testAuthorDeduplication();

    // Print final results
    const success = await printResults();

    process.exit(success ? 0 : 1);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
