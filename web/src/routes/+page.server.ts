// All dashboard data is fetched here, server-side (no client $effect/fetch). The data
// is loaded at full extent ONCE; view state (chart range, repo window/sort) lives in
// the page as plain $state and slices/sorts this data client-side — so toggling a
// control is instant and never re-runs the load or touches the URL.
import {
    getMau,
    getDiagnose,
    getRepoAggregates,
    getDevAggregates,
    loadEvents,
} from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// 28 days before the parquet horizon = start of the current MAD window (UTC, no drift).
const minusDays = (day: string, n: number): string =>
    new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) - n * 86400000)
        .toISOString()
        .slice(0, 10);

export const load: PageServerLoad = async ({ url, parent }) => {
    // Default load is bounded to 365 days (covers the 60/90/120/365 toggles via
    // client-side slicing — small payload). The `all` chart view escalates to the full
    // series via a single `?range=all` flag; navigating to it re-runs this load natively.
    const full = url.searchParams.get('range') === 'all';

    // sequential: the DuckDB connection is a single shared handle
    const mau = await getMau(full ? 100000 : 365);
    const diag = await getDiagnose(400); // cohort/surge range (capped regardless)
    const repos = await getRepoAggregates(); // 28/60/90-day windows; leaderboard derives
    const devs = await getDevAggregates(); // top devs w/ identity; [] until resolve-devs
    const events = await loadEvents();

    const { meta } = await parent();
    const windowStart = meta?.parquet_horizon ? minusDays(meta.parquet_horizon, 28) : null;

    return { mau, diag, repos, devs, events, windowStart, full };
};
