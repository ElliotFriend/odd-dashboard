// Loads curated timeline events from the version-controlled events.json.
// That file is the source of truth (managed by `stellar_odd.py events ...`),
// NOT the DuckDB extract — so hand-curated annotations survive DB rebuilds.
import { readFile } from 'node:fs/promises';
import { env } from '$env/dynamic/private';
import type { TimelineEvent } from '$lib/types';

// Default is relative to the app's CWD (web/), mirroring STELLAR_DB's `../` convention.
const EVENTS_FILE = env.EVENTS_FILE || '../events.json';

export async function loadEvents(): Promise<TimelineEvent[]> {
    try {
        const raw = await readFile(EVENTS_FILE, 'utf8');
        const data: unknown = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        return (data as TimelineEvent[])
            .filter((e) => e && e.title && e.start && e.end)
            .sort((a, b) => a.start.localeCompare(b.start));
    } catch {
        return []; // missing/invalid file → no annotations, the dashboard still works
    }
}
