import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as schema from '../src/lib/server/db/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

// Child ecosystems to add under Stellar
const stellarChildEcosystems = [
    'Air Protocol',
    'Aquarius (AQUA token)',
    'AssetDesk',
    'BP Ventures',
    'Cheesecake Labs',
    'CometDEX',
    'DSTOQ',
    'Edge',
    'Gladius Club',
    'Keizai',
    'KwickBit',
    'Litemint',
    'LumenSwap',
    'Mobius',
    'Obsrvr',
    'paltalabs',
    'PlutoDAO',
    'Rabet',
    'Soneso',
    'Stronghold',
    'Tellus-Cooperative',
    'walletban',
    'Whalestack LLC',
];

async function seedEcosystems() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL is not set');
        process.exit(1);
    }

    console.log('🌱 Seeding ecosystems...');

    const client = postgres(databaseUrl, {
        max: 1,
        connect_timeout: 10,
    });

    const db = drizzle(client, { schema });

    try {
        // Check existing ecosystems
        const existingEcosystems = await db
            .select()
            .from(schema.ecosystems)
            .where(eq(schema.ecosystems.name, 'Stellar'));

        let stellar;
        if (existingEcosystems.length > 0) {
            stellar = existingEcosystems[0];
            console.log(`⏭️  Skipped: ${stellar.name} (already exists, id: ${stellar.id})`);
        } else {
            // Insert Stellar ecosystem
            [stellar] = await db
                .insert(schema.ecosystems)
                .values({
                    name: 'Stellar',
                    parentId: null,
                })
                .returning();

            console.log(`✅ Inserted: ${stellar.name} (id: ${stellar.id})`);
        }

        // Insert child ecosystems under Stellar
        if (stellarChildEcosystems.length > 0) {
            console.log(`\n🌿 Adding ${stellarChildEcosystems.length} child ecosystem(s) under Stellar...`);
            for (const ecosystemName of stellarChildEcosystems) {
                const existing = await db
                    .select()
                    .from(schema.ecosystems)
                    .where(eq(schema.ecosystems.name, ecosystemName));

                if (existing.length > 0) {
                    console.log(
                        `⏭️  Skipped: ${ecosystemName} (already exists, id: ${existing[0].id})`
                    );
                } else {
                    const [child] = await db
                        .insert(schema.ecosystems)
                        .values({
                            name: ecosystemName,
                            parentId: stellar.id,
                        })
                        .returning();

                    console.log(
                        `✅ Inserted: ${child.name} (id: ${child.id}, parent_id: ${child.parentId})`
                    );
                }
            }
        }

        // Verify data was inserted
        const allEcosystems = await db.select().from(schema.ecosystems);
        console.log(`\n✅ Seed complete! Total ecosystems: ${allEcosystems.length}`);
        console.log('\nEcosystems in database:');
        allEcosystems.forEach((eco) => {
            console.log(`  - ${eco.name} (id: ${eco.id}, parent_id: ${eco.parentId || 'null'})`);
        });

        await client.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding ecosystems:');
        console.error(error);
        await client.end();
        process.exit(1);
    }
}

seedEcosystems();

