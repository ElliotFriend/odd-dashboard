import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
}

async function resetDatabase() {
    console.log('🔄 Starting database reset...\n');

    const client = postgres(connectionString!, { max: 1 });
    const db = drizzle(client);

    try {
        // Step 1: Drop all tables
        console.log('Step 1: Dropping all tables...');

        await db.execute(sql`DROP TABLE IF EXISTS repository_ecosystems CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS repository_events CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS author_events CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS commits CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS events CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS repositories CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS authors CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS ecosystems CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS agencies CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`);

        console.log('  ✓ All tables dropped\n');

        // Close the connection before running drizzle-kit
        await client.end();

        // Step 2: Push schema to recreate tables
        console.log('Step 2: Recreating tables from schema...');
        execSync('npx drizzle-kit push', { stdio: 'inherit' });
        console.log('  ✓ Tables recreated\n');

        console.log('✅ Database reset complete!');
        console.log('\n💡 Your database is now empty and ready to use.');
        console.log('   To add seed data, run: npm run db:seed');
    } catch (error) {
        console.error('\n❌ Error resetting database:', error);
        throw error;
    }
}

// Run the reset
resetDatabase()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
