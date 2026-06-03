// Shared server-side queries against the DuckDB extract. The page's server `load`
// and the /api/* endpoints both call these, so the SQL lives in exactly one place.
import { query, meta } from '$lib/server/db';
import { loadEvents } from '$lib/server/events';
import type {
  WindowedRow, DailyRow, ApiRow, MauResponse,
  RepoRow, ReposResponse, CohortRow, Intensity, SurgeDay, DiagnoseResponse
} from '$lib/types';

/** 28-day windowed MAD series + daily overlay + fresher API points + provenance. */
export async function getMau(days: number): Promise<MauResponse> {
  const windowed = await query<WindowedRow>(
    `SELECT day, all_devs, exclusive_devs, multichain_devs, num_commits
     FROM eco_mads
     WHERE day > (SELECT max(day) FROM eco_mads) - ?
     ORDER BY day`, [days]);

  const daily = await query<DailyRow>(
    `SELECT day, daily_active_devs, daily_commits
     FROM daily_activity
     WHERE day > (SELECT max(day) FROM daily_activity) - ?
     ORDER BY day`, [days]);

  let api: ApiRow[] = [];
  try {
    api = await query<ApiRow>(
      `SELECT day, total, single_chain, multi_chain FROM mau_api_history
       WHERE day > (SELECT max(day) FROM mau_api_history) - ? ORDER BY day`, [days]);
  } catch { /* mau_api_history may not exist yet */ }

  return { windowed, daily, api, meta: await meta() };
}

/** Repo leaderboard over a trailing window: devs + commits per repo, with names + URLs. */
export async function getRepos(days: number, by: string): Promise<ReposResponse> {
  const order = by === 'commits' ? 'commits' : 'devs';
  const rc = await query<{ name: string }>("PRAGMA table_info('repos')");
  const names = rc.map((r) => r.name);
  const idCol = names.includes('id') ? 'id' : 'repo_id';
  const nameCol = ['name', 'repo_url', 'url'].find((n) => names.includes(n)) || idCol;     // owner/repo display
  const urlCol = ['link', 'repo_url', 'url'].find((n) => names.includes(n)) || nameCol;     // full GitHub URL

  const rows = await query<RepoRow>(
    `WITH w AS (
       SELECT repo_id, count(DISTINCT dev) AS devs, sum(num_commits) AS commits,
              max(day) AS last_active_day
       FROM repo_day
       WHERE day > (SELECT max(day) FROM repo_day) - ?
       GROUP BY repo_id)
     SELECT rp."${urlCol}" AS url, rp."${nameCol}" AS repo, w.devs, w.commits, w.last_active_day
     FROM w LEFT JOIN repos rp ON rp."${idCol}" = w.repo_id
     ORDER BY ${order} DESC LIMIT 30`, [days]);
  return { rows, days, order: order as 'devs' | 'commits' };
}

/** "What moved the metric": rolling cohort split, contributor intensity, daily surges. */
export async function getDiagnose(days: number): Promise<DiagnoseResponse> {
  const W = 28;
  const R = Math.max(60, Math.min(400, days || 120));

  const cohort = await query<CohortRow>(`
    WITH anchors AS (
      SELECT DISTINCT day AS d FROM dev_day
      WHERE day > (SELECT max(day) FROM dev_day) - ${R}),
    cur AS (SELECT a.d, dd.dev FROM anchors a
            JOIN dev_day dd ON dd.day > a.d - ${W} AND dd.day <= a.d GROUP BY a.d, dd.dev),
    prv AS (SELECT a.d, dd.dev FROM anchors a
            JOIN dev_day dd ON dd.day > a.d - ${2 * W} AND dd.day <= a.d - ${W} GROUP BY a.d, dd.dev)
    SELECT cur.d AS day, COUNT(*) AS total,
           COUNT(*) FILTER (WHERE prv.dev IS NOT NULL) AS recurring,
           COUNT(*) FILTER (WHERE prv.dev IS NULL)     AS new_devs
    FROM cur LEFT JOIN prv ON prv.d = cur.d AND prv.dev = cur.dev
    GROUP BY cur.d ORDER BY cur.d`);

  const intensity = (await query<Intensity>(`
    SELECT SUM(num_commits) AS commits, COUNT(DISTINCT dev) AS devs,
           ROUND(SUM(num_commits)*1.0/NULLIF(COUNT(DISTINCT dev),0), 2) AS commits_per_dev
    FROM dev_day WHERE day > (SELECT max(day) FROM dev_day) - ${W}`))[0] ?? {};

  const surgeDays = await query<SurgeDay>(`
    WITH d AS (SELECT day, daily_active_devs,
        median(daily_active_devs) OVER (ORDER BY day RANGE BETWEEN 90 PRECEDING AND 1 PRECEDING) AS base
      FROM daily_activity)
    SELECT day, daily_active_devs AS devs, base FROM d
    WHERE base IS NOT NULL AND daily_active_devs > 2*base
      AND day > (SELECT max(day) FROM daily_activity) - ${R}
    ORDER BY day`);

  return { cohort, intensity, surgeDays, window: W };
}

export { loadEvents };
