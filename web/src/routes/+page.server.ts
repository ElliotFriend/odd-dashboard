// All dashboard data is fetched here, server-side, instead of via client $effect +
// fetch. View state (days / repo window / repo order) lives in the URL search params,
// so changing a toggle is a navigation that re-runs this load.
import { getMau, getRepos, getDiagnose, loadEvents } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

// 28 days before the parquet horizon = start of the current MAD window (UTC, no drift).
const minusDays = (day: string, n: number): string =>
  new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) - n * 86400000)
    .toISOString().slice(0, 10);

export const load: PageServerLoad = async ({ url, parent }) => {
  const days = Number(url.searchParams.get('days') || 120);
  const repoWin = Number(url.searchParams.get('repoWin') || 28);
  const repoBy = url.searchParams.get('repoBy') === 'commits' ? 'commits' : 'devs';

  // sequential: the DuckDB connection is a single shared handle
  const mau = await getMau(days);
  const repos = await getRepos(repoWin, repoBy);
  const diag = await getDiagnose(days);
  const events = await loadEvents();

  const { meta } = await parent();
  const windowStart = meta?.parquet_horizon ? minusDays(meta.parquet_horizon, 28) : null;

  return { mau, repos, diag, events, windowStart, params: { days, repoWin, repoBy } };
};
