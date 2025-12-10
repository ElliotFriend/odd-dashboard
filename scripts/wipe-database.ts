import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
}

async function wipeDatabase() {
    console.log('🗑️  Starting database wipe...\n');

    const client = postgres(connectionString!, { max: 1 });
    const db = drizzle(client);

    try {
        // Drop all tables in the correct order (reverse of dependencies)
        console.log('📋 Dropping tables...');

        // First drop junction/relationship tables
        await db.execute(sql`DROP TABLE IF EXISTS repository_ecosystems CASCADE`);
        console.log('  ✓ Dropped repository_ecosystems');

        await db.execute(sql`DROP TABLE IF EXISTS repository_events CASCADE`);
        console.log('  ✓ Dropped repository_events');

        await db.execute(sql`DROP TABLE IF EXISTS author_events CASCADE`);
        console.log('  ✓ Dropped author_events');

        // Then drop tables with foreign keys
        await db.execute(sql`DROP TABLE IF EXISTS commits CASCADE`);
        console.log('  ✓ Dropped commits');

        await db.execute(sql`DROP TABLE IF EXISTS events CASCADE`);
        console.log('  ✓ Dropped events');

        await db.execute(sql`DROP TABLE IF EXISTS repositories CASCADE`);
        console.log('  ✓ Dropped repositories');

        await db.execute(sql`DROP TABLE IF EXISTS authors CASCADE`);
        console.log('  ✓ Dropped authors');

        await db.execute(sql`DROP TABLE IF EXISTS ecosystems CASCADE`);
        console.log('  ✓ Dropped ecosystems');

        await db.execute(sql`DROP TABLE IF EXISTS agencies CASCADE`);
        console.log('  ✓ Dropped agencies');

        // Drop Drizzle metadata table
        await db.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`);
        console.log('  ✓ Dropped __drizzle_migrations');

        console.log('\n✅ Database wiped successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Run migrations: npm run db:push');
        console.log('   2. Seed data (if needed): npm run db:seed');
    } catch (error) {
        console.error('\n❌ Error wiping database:', error);
        throw error;
    } finally {
        await client.end();
    }
}

// Run the wipe
wipeDatabase()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
