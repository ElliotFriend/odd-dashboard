// All dashboard data is fetched here, server-side (no client $effect/fetch). The data
// is loaded at full extent ONCE; view state (chart range, repo window/sort) lives in
// the page as plain $state and slices/sorts this data client-side — so toggling a
// control is instant and never re-runs the load or touches the URL.
import { getMau, getDiagnose, getRepoAggregates, loadEvents } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// 28 days before the parquet horizon = start of the current MAD window (UTC, no drift).
const minusDays = (day: string, n: number): string =>
  new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) - n * 86400000)
    .toISOString().slice(0, 10);

export const load: PageServerLoad = async ({ parent }) => {
  // sequential: the DuckDB connection is a single shared handle
  const mau = await getMau(100000);          // full series; the chart slices client-side
  const diag = await getDiagnose(400);       // max cohort/surge range
  const repos = await getRepoAggregates();   // 28/60/90-day windows; leaderboard derives
  const events = await loadEvents();

  const { meta } = await parent();
  const windowStart = meta?.parquet_horizon ? minusDays(meta.parquet_horizon, 28) : null;

  return { mau, diag, repos, events, windowStart };
};
