import { db } from "../src/lib/server/db/index.js";
import { sql } from "drizzle-orm";

/**
 * Verify Database Schema
 *
 * This script checks that all expected tables, indexes, and constraints exist in the database
 */

interface TestResult {
    name: string;
    passed: boolean;
    message?: string;
}

const results: TestResult[] = [];

async function verifyTables() {
    console.log("\n🔍 Verifying Tables...\n");

    const expectedTables = [
        "ecosystems",
        "agencies",
        "repositories",
        "authors",
        "commits",
        "events",
        "author_events",
        "repository_events",
        "repository_ecosystems",
    ];

    const tableResults = await db.execute<{ tablename: string }>(
        sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const actualTables = (tableResults as any[]).map(
        (row) => row.tablename,
    );

    for (const table of expectedTables) {
        const exists = actualTables.includes(table);
        results.push({
            name: `Table: ${table}`,
            passed: exists,
            message: exists
                ? undefined
                : `Table '${table}' does not exist`,
        });
    }
}

async function verifyIndexes() {
    console.log("\n🔍 Verifying Indexes...\n");

    const expectedIndexes = [
        "commits_commit_date_idx",
        "commits_repository_id_idx",
        "commits_author_id_idx",
        "commits_sha_idx",
        "commits_branch_idx",
        "commits_repository_commit_date_idx",
        "repository_ecosystems_repository_id_idx",
        "repository_ecosystems_ecosystem_id_idx",
        "repositories_agency_id_idx",
        "authors_agency_id_idx",
        "authors_email_idx",
        "authors_github_id_idx",
        "events_agency_id_idx",
        "repositories_parent_repository_id_idx",
        "repositories_is_fork_idx",
        "ecosystems_parent_id_idx",
        "author_events_author_id_idx",
        "author_events_event_id_idx",
        "repository_events_repository_id_idx",
        "repository_events_event_id_idx",
    ];

    const indexResults = await db.execute<{ indexname: string }>(
        sql`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const actualIndexes = (indexResults as any[]).map((row) => row.indexname);

    for (const index of expectedIndexes) {
        const exists = actualIndexes.includes(index);
        results.push({
            name: `Index: ${index}`,
            passed: exists,
            message: exists ? undefined : `Index '${index}' does not exist`,
        });
    }
}

async function verifyForeignKeys() {
    console.log("\n🔍 Verifying Foreign Keys...\n");

    const expectedFKs = [
        {
            table: "ecosystems",
            constraint: "ecosystems_parent_id_ecosystems_id_fk",
        },
        {
            table: "repositories",
            constraint: "repositories_agency_id_agencies_id_fk",
        },
        {
            table: "repositories",
            constraint:
                "repositories_parent_repository_id_repositories_id_fk",
        },
        { table: "authors", constraint: "authors_agency_id_agencies_id_fk" },
        {
            table: "commits",
            constraint: "commits_repository_id_repositories_id_fk",
        },
        { table: "commits", constraint: "commits_author_id_authors_id_fk" },
        { table: "events", constraint: "events_agency_id_agencies_id_fk" },
        {
            table: "author_events",
            constraint: "author_events_author_id_authors_id_fk",
        },
        {
            table: "author_events",
            constraint: "author_events_event_id_events_id_fk",
        },
        {
            table: "repository_events",
            constraint: "repository_events_repository_id_repositories_id_fk",
        },
        {
            table: "repository_events",
            constraint: "repository_events_event_id_events_id_fk",
        },
        {
            table: "repository_ecosystems",
            constraint:
                "repository_ecosystems_repository_id_repositories_id_fk",
        },
        {
            table: "repository_ecosystems",
            constraint: "repository_ecosystems_ecosystem_id_ecosystems_id_fk",
        },
    ];

    const fkResults = await db.execute<{
        table_name: string;
        constraint_name: string;
    }>(
        sql`SELECT tc.table_name, tc.constraint_name
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'`,
    );

    for (const fk of expectedFKs) {
        const exists = (fkResults as any[]).some(
            (row) =>
                row.table_name === fk.table &&
                row.constraint_name === fk.constraint,
        );
        results.push({
            name: `FK: ${fk.table}.${fk.constraint}`,
            passed: exists,
            message: exists
                ? undefined
                : `Foreign key '${fk.constraint}' on table '${fk.table}' does not exist`,
        });
    }
}

async function verifyUniqueConstraints() {
    console.log("\n🔍 Verifying Unique Constraints...\n");

    const expectedConstraints = [
        { table: "ecosystems", constraint: "ecosystems_name_unique" },
        { table: "agencies", constraint: "agencies_name_unique" },
        { table: "repositories", constraint: "repositories_github_id_unique" },
        {
            table: "repositories",
            constraint: "repositories_full_name_unique",
        },
        { table: "authors", constraint: "authors_github_id_unique" },
        { table: "events", constraint: "events_name_unique" },
    ];

    const constraintResults = await db.execute<{
        table_name: string;
        constraint_name: string;
    }>(
        sql`SELECT tc.table_name, tc.constraint_name
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_schema = 'public'`,
    );

    for (const constraint of expectedConstraints) {
        const exists = (constraintResults as any[]).some(
            (row) =>
                row.table_name === constraint.table &&
                row.constraint_name === constraint.constraint,
        );
        results.push({
            name: `Unique: ${constraint.table}.${constraint.constraint}`,
            passed: exists,
            message: exists
                ? undefined
                : `Unique constraint '${constraint.constraint}' on table '${constraint.table}' does not exist`,
        });
    }
}

async function verifyCompositeUnique() {
    console.log("\n🔍 Verifying Composite Unique Constraints...\n");

    const expectedCompositeConstraints = [
        {
            table: "commits",
            constraint: "commits_repository_sha_unique",
        },
    ];

    const constraintResults = await db.execute<{
        table_name: string;
        constraint_name: string;
    }>(
        sql`SELECT tc.table_name, tc.constraint_name
            FROM information_schema.table_constraints tc
            WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_schema = 'public'`,
    );

    for (const constraint of expectedCompositeConstraints) {
        const exists = (constraintResults as any[]).some(
            (row) =>
                row.table_name === constraint.table &&
                row.constraint_name === constraint.constraint,
        );
        results.push({
            name: `Composite Unique: ${constraint.table}.${constraint.constraint}`,
            passed: exists,
            message: exists
                ? undefined
                : `Composite unique constraint '${constraint.constraint}' on table '${constraint.table}' does not exist`,
        });
    }
}

async function printResults() {
    console.log("\n" + "=".repeat(80));
    console.log("DATABASE SCHEMA VERIFICATION RESULTS");
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
    console.log("Starting database schema verification...");

    try {
        await verifyTables();
        await verifyIndexes();
        await verifyForeignKeys();
        await verifyUniqueConstraints();
        await verifyCompositeUnique();

        const success = await printResults();

        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error("Error during verification:", error);
        process.exit(1);
    }
}

main();
