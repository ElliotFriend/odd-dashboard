// Server-only DuckDB access layer. Reads the extract produced by stellar_odd.py.
// Opens READ_ONLY so a scheduled `extract` re-run won't lock against the app.
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { env } from '$env/dynamic/private';
import type { Meta } from '$lib/types';

const DB_PATH = env.STELLAR_DB || './stellar_extract.duckdb';

let _conn: DuckDBConnection | null = null;
async function conn(): Promise<DuckDBConnection> {
    if (_conn) return _conn;
    const instance = await DuckDBInstance.create(DB_PATH, { access_mode: 'READ_ONLY' });
    _conn = await instance.connect();
    return _conn;
}

// Normalize DuckDB values into JSON-serializable JS:
//   BigInt                              -> Number
//   Date                                -> 'yyyy-mm-dd'
//   DuckDBDateValue ({ days })          -> 'yyyy-mm-dd'
//   DuckDBTimestamp(TZ)Value ({ micros }) -> ISO 8601 string (UTC)
// The micros case matters because the wrapper holds a BigInt internally, which
// json() would otherwise choke on ("Do not know how to serialize a BigInt").
function clean(v: unknown): unknown {
    if (typeof v === 'bigint') return Number(v);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v && typeof v === 'object') {
        if ('days' in v)
            // DuckDBDateValue
            return new Date((v as { days: number }).days * 86400000).toISOString().slice(0, 10);
        if ('micros' in v)
            // DuckDBTimestamp(TZ)Value: micros since epoch
            return new Date(Number((v as { micros: bigint }).micros) / 1000).toISOString();
    }
    return v;
}

export async function query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
): Promise<T[]> {
    const c = await conn();
    // params are plain JS primitives; cast to the lib's expected value type at this boundary.
    const reader = params.length
        ? await c.runAndReadAll(sql, params as Parameters<DuckDBConnection['runAndReadAll']>[1])
        : await c.runAndReadAll(sql);
    return reader.getRowObjects().map((row) => {
        const o: Record<string, unknown> = {};
        for (const k of Object.keys(row)) o[k] = clean(row[k]);
        return o as T;
    });
}

export async function meta(): Promise<Meta> {
    try {
        return (await query<Meta>('SELECT * FROM meta'))[0] ?? {};
    } catch {
        return {};
    }
}
