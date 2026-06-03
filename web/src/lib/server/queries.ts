// Shared server-side queries against the DuckDB extract. The page's server `load`
// and the /api/* endpoints both call these, so the SQL lives in exactly one place.
import { query, meta } from '$lib/server/db';
import { loadEvents } from '$lib/server/events';
import type {
  WindowedRow, DailyRow, ApiRow, MauResponse,
  RepoRow, ReposResponse, RepoAgg, DevAgg, CohortRow, Intensity, SurgeDay, DiagnoseResponse
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

/** Per-repo devs+commits for the 28/60/90-day windows at once, for repos active in
 *  the last 90 days. The page loads this once and the leaderboard derives the chosen
 *  window + sort client-side (no re-query per toggle). */
export async function getRepoAggregates(): Promise<RepoAgg[]> {
  const rc = await query<{ name: string }>("PRAGMA table_info('repos')");
  const names = rc.map((r) => r.name);
  const idCol = names.includes('id') ? 'id' : 'repo_id';
  const nameCol = ['name', 'repo_url', 'url'].find((n) => names.includes(n)) || idCol;
  const urlCol = ['link', 'repo_url', 'url'].find((n) => names.includes(n)) || nameCol;
  return query<RepoAgg>(`
    WITH h AS (SELECT max(day) AS m FROM repo_day),
    w AS (
      SELECT repo_id, max(day) AS last_active_day,
        COUNT(DISTINCT dev) FILTER (WHERE day > (SELECT m FROM h) - 28)        AS d28,
        COALESCE(SUM(num_commits) FILTER (WHERE day > (SELECT m FROM h) - 28), 0) AS c28,
        COUNT(DISTINCT dev) FILTER (WHERE day > (SELECT m FROM h) - 60)        AS d60,
        COALESCE(SUM(num_commits) FILTER (WHERE day > (SELECT m FROM h) - 60), 0) AS c60,
        COUNT(DISTINCT dev) FILTER (WHERE day > (SELECT m FROM h) - 90)        AS d90,
        COALESCE(SUM(num_commits) FILTER (WHERE day > (SELECT m FROM h) - 90), 0) AS c90
      FROM repo_day
      WHERE day > (SELECT m FROM h) - 90
      GROUP BY repo_id)
    SELECT rp."${urlCol}" AS url, rp."${nameCol}" AS repo, w.last_active_day,
           w.d28, w.c28, w.d60, w.c60, w.d90, w.c90
    FROM w LEFT JOIN repos rp ON rp."${idCol}" = w.repo_id`);
}

/** Top developers (active in 90d, non-bot) with commits/active-days/repos-touched per
 *  28/60/90-day window, joined to the `developers` identity table (name + GitHub login).
 *  Returns [] if `developers` hasn't been built yet (`stellar_odd.py resolve-devs`). */
export async function getDevAggregates(): Promise<DevAgg[]> {
  try {
    return await query<DevAgg>(`
      WITH hd AS (SELECT max(day) m FROM dev_day),
      hr AS (SELECT max(day) m FROM repo_day),
      dd AS (
        SELECT dev,
          COALESCE(SUM(num_commits) FILTER (WHERE day > (SELECT m FROM hd)-28), 0) c28,
          COUNT(DISTINCT day)       FILTER (WHERE day > (SELECT m FROM hd)-28)    a28,
          COALESCE(SUM(num_commits) FILTER (WHERE day > (SELECT m FROM hd)-60), 0) c60,
          COUNT(DISTINCT day)       FILTER (WHERE day > (SELECT m FROM hd)-60)    a60,
          COALESCE(SUM(num_commits) FILTER (WHERE day > (SELECT m FROM hd)-90), 0) c90,
          COUNT(DISTINCT day)       FILTER (WHERE day > (SELECT m FROM hd)-90)    a90
        FROM dev_day WHERE day > (SELECT m FROM hd)-90 GROUP BY dev),
      rr AS (
        SELECT dev,
          COUNT(DISTINCT repo_id) FILTER (WHERE day > (SELECT m FROM hr)-28) r28,
          COUNT(DISTINCT repo_id) FILTER (WHERE day > (SELECT m FROM hr)-60) r60,
          COUNT(DISTINCT repo_id) FILTER (WHERE day > (SELECT m FROM hr)-90) r90
        FROM repo_day WHERE day > (SELECT m FROM hr)-90 GROUP BY dev)
      SELECT dv.canonical_developer_id AS dev, dv.name, dv.login,
             dd.c28, dd.a28, COALESCE(rr.r28, 0) r28,
             dd.c60, dd.a60, COALESCE(rr.r60, 0) r60,
             dd.c90, dd.a90, COALESCE(rr.r90, 0) r90
      FROM dd
      JOIN developers dv ON dv.canonical_developer_id = dd.dev AND NOT dv.is_bot
      LEFT JOIN rr ON rr.dev = dd.dev
      ORDER BY dd.c90 DESC LIMIT 200`);
  } catch {
    return []; // developers table not built yet
  }
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
