import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

async function testConnection() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL is not set');
        process.exit(1);
    }

    console.log('🔌 Testing database connection...');
    console.log(`   Connection string: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

    try {
        const client = postgres(databaseUrl, {
            max: 1,
            connect_timeout: 10,
        });

        // Test connection
        const result = await client`SELECT version() as version, current_database() as database`;
        const { version, database } = result[0];

        console.log('✅ Database connection successful!');
        console.log(`   Database: ${database}`);
        console.log(`   PostgreSQL version: ${version.split(',')[0]}`);

        await client.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error(error);
        process.exit(1);
    }
}

testConnection();

