import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is not set');

// Configure connection pool: min 2, max 10 connections
const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
});

export const db = drizzle(client, { schema, casing: 'snake_case' });
