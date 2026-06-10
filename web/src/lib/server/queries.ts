// Shared server-side queries against the DuckDB extract. The page's server `load`
// and the /api/* endpoints both call these, so the SQL lives in exactly one place.
import { query, meta } from '$lib/server/db';
import { loadEvents } from '$lib/server/events';
import type {
    WindowedRow,
    DailyRow,
    ApiRow,
    MadResponse,
    RepoRow,
    ReposResponse,
    RepoAgg,
    DevAgg,
    CohortRow,
    Intensity,
    SurgeDay,
    DiagnoseResponse,
    DevDetail,
    RepoDetail,
    DevRepoRow,
    RepoDevRow,
    DayPair,
    DayDetail,
} from '$lib/types';

// repos column names (introspected once; the extract carries id/name/link).
async function repoCols() {
    const names = (await query<{ name: string }>("PRAGMA table_info('repos')")).map((r) => r.name);
    return {
        id: names.includes('id') ? 'id' : 'repo_id',
        name: ['name', 'repo_url', 'url'].find((n) => names.includes(n)) || 'id',
        url: ['link', 'repo_url', 'url'].find((n) => names.includes(n)) || 'name',
    };
}

async function hasDevelopers(): Promise<boolean> {
    return (
        (await query("SELECT 1 FROM information_schema.tables WHERE table_name = 'developers'"))
            .length > 0
    );
}

/** 28-day windowed MAD series + daily overlay + fresher API points + provenance. */
export async function getMad(days: number): Promise<MadResponse> {
    const windowed = await query<WindowedRow>(
        `SELECT day, all_devs, exclusive_devs, multichain_devs, num_commits
     FROM eco_mads
     WHERE day > (SELECT max(day) FROM eco_mads) - ?
     ORDER BY day`,
        [days],
    );

    const daily = await query<DailyRow>(
        `SELECT day, daily_active_devs, daily_commits
     FROM daily_activity
     WHERE day > (SELECT max(day) FROM daily_activity) - ?
     ORDER BY day`,
        [days],
    );

    let api: ApiRow[] = [];
    try {
        api = await query<ApiRow>(
            `SELECT day, total, single_chain, multi_chain FROM mad_api_history
       WHERE day > (SELECT max(day) FROM mad_api_history) - ? ORDER BY day`,
            [days],
        );
    } catch {
        /* mad_api_history may not exist yet */
    }

    return { windowed, daily, api, meta: await meta() };
}

/** Repo leaderboard over a trailing window: devs + commits per repo, with names + URLs. */
export async function getRepos(days: number, by: string): Promise<ReposResponse> {
    const order = by === 'commits' ? 'commits' : 'devs';
    const rc = await query<{ name: string }>("PRAGMA table_info('repos')");
    const names = rc.map((r) => r.name);
    const idCol = names.includes('id') ? 'id' : 'repo_id';
    const nameCol = ['name', 'repo_url', 'url'].find((n) => names.includes(n)) || idCol; // owner/repo display
    const urlCol = ['link', 'repo_url', 'url'].find((n) => names.includes(n)) || nameCol; // full GitHub URL

    const rows = await query<RepoRow>(
        `WITH w AS (
       SELECT repo_id, count(DISTINCT dev) AS devs, sum(num_commits) AS commits,
              max(day) AS last_active_day
       FROM repo_day
       WHERE day > (SELECT max(day) FROM repo_day) - ?
       GROUP BY repo_id)
     SELECT rp."${urlCol}" AS url, rp."${nameCol}" AS repo, w.devs, w.commits, w.last_active_day
     FROM w LEFT JOIN repos rp ON rp."${idCol}" = w.repo_id
     ORDER BY ${order} DESC LIMIT 30`,
        [days],
    );
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

    // Windowed commits/dev lives in a narrow band (~14-36 observed since 2024), so the
    // badge reads the current value against the trailing year's own quartiles rather
    // than absolute thresholds. Empirically (events.json-labeled windows), event-heavy
    // windows run HIGH — participants out-commit the quiet base — and the lows are
    // post-event cooldowns; interpretation lives in WhatMoved.svelte.
    const intensity =
        (
            await query<Intensity>(`
    WITH cur AS (
      SELECT SUM(num_commits) AS commits, COUNT(DISTINCT dev) AS devs,
             ROUND(SUM(num_commits)*1.0/NULLIF(COUNT(DISTINCT dev),0), 2) AS commits_per_dev
      FROM dev_day WHERE day > (SELECT max(day) FROM dev_day) - ${W}),
    anchors AS (
      SELECT DISTINCT day AS d FROM dev_day
      WHERE day > (SELECT max(day) FROM dev_day) - 365),
    hist AS (
      SELECT a.d, SUM(dd.num_commits)*1.0/NULLIF(COUNT(DISTINCT dd.dev),0) AS cpd
      FROM anchors a JOIN dev_day dd ON dd.day > a.d - ${W} AND dd.day <= a.d
      GROUP BY a.d)
    SELECT cur.commits, cur.devs, cur.commits_per_dev,
           ROUND(median(hist.cpd), 2)              AS baseline_cpd,
           ROUND(quantile_cont(hist.cpd, 0.25), 2) AS cpd_p25,
           ROUND(quantile_cont(hist.cpd, 0.75), 2) AS cpd_p75
    FROM hist, cur GROUP BY cur.commits, cur.devs, cur.commits_per_dev`)
        )[0] ?? {};

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

// commits + active-days per 28/60/90-day window and all-time, for a repo_day GROUP BY.
// `rd.day > X` filters; aliases avoid DuckDB reserved words. Caller wraps with `WITH h`.
const WINDOW_COLS = `
  COALESCE(SUM(rd.num_commits) FILTER (WHERE rd.day > (SELECT m FROM h) - 28), 0) AS c28,
  COUNT(DISTINCT rd.day)       FILTER (WHERE rd.day > (SELECT m FROM h) - 28)      AS a28,
  COALESCE(SUM(rd.num_commits) FILTER (WHERE rd.day > (SELECT m FROM h) - 60), 0) AS c60,
  COUNT(DISTINCT rd.day)       FILTER (WHERE rd.day > (SELECT m FROM h) - 60)      AS a60,
  COALESCE(SUM(rd.num_commits) FILTER (WHERE rd.day > (SELECT m FROM h) - 90), 0) AS c90,
  COUNT(DISTINCT rd.day)       FILTER (WHERE rd.day > (SELECT m FROM h) - 90)      AS a90,
  SUM(rd.num_commits) AS c_all, COUNT(DISTINCT rd.day) AS a_all,
  max(rd.day) AS last_active`;

/** Drill-down: every repo a developer (by GitHub login) committed to, with per-window
 *  (28/60/90d + all-time) commits/active-days so the page can filter client-side. */
export async function getDevDetail(login: string): Promise<DevDetail | null> {
    if (!(await hasDevelopers())) return null;
    const dev = (
        await query<{ cid: number; name: string | null; login: string }>(
            'SELECT canonical_developer_id cid, name, login FROM developers WHERE login = ? LIMIT 1',
            [login],
        )
    )[0];
    if (!dev) return null;
    const c = await repoCols();
    const repos = await query<DevRepoRow>(
        `WITH h AS (SELECT max(day) m FROM repo_day)
     SELECT rp."${c.name}" AS repo, rp."${c.url}" AS url, ${WINDOW_COLS}
     FROM repo_day rd JOIN repos rp ON rp."${c.id}" = rd.repo_id
     WHERE rd.dev = ? GROUP BY 1, 2 ORDER BY c_all DESC LIMIT 200`,
        [dev.cid],
    );
    return { login: dev.login, name: dev.name, repos };
}

/** Drill-down: every developer who has committed to a repo (by owner/repo name), all-time. */
export async function getRepoDetail(slug: string): Promise<RepoDetail | null> {
    const c = await repoCols();
    const repo = (
        await query<{ id: number; repo: string; url: string }>(
            `SELECT "${c.id}" AS id, "${c.name}" AS repo, "${c.url}" AS url FROM repos WHERE "${c.name}" = ? LIMIT 1`,
            [slug],
        )
    )[0];
    if (!repo) return null;
    // join identities when the developers table exists; otherwise devs show as ids only
    const hasDev = await hasDevelopers();
    const idJoin = hasDev ? 'LEFT JOIN developers dv ON dv.canonical_developer_id = rd.dev' : '';
    const nameExpr = hasDev ? 'any_value(dv.name)' : 'NULL';
    const loginExpr = hasDev ? 'any_value(dv.login)' : 'NULL';
    const devs = await query<RepoDevRow>(
        `WITH h AS (SELECT max(day) m FROM repo_day)
     SELECT rd.dev, ${nameExpr} AS "name", ${loginExpr} AS "login", ${WINDOW_COLS}
     FROM repo_day rd ${idJoin}
     WHERE rd.repo_id = ? GROUP BY rd.dev ORDER BY c_all DESC LIMIT 200`,
        [repo.id],
    );
    return { repo: repo.repo, url: repo.url, devs };
}

/** Day drill-down: everything active on one calendar day. One small pairs query (≤~1.2k
 *  rows) drives both the repo→devs and dev→repos groupings client-side; plus a
 *  returning-vs-new cohort split and prev/next active-day bounds for navigation. */
export async function getDayDetail(date: string): Promise<DayDetail> {
    const c = await repoCols();
    const hasDev = await hasDevelopers();
    // Identity columns toggle on the developers table, mirroring getRepoDetail.
    const idJoin = hasDev ? 'LEFT JOIN developers dv ON dv.canonical_developer_id = rd.dev' : '';
    const nameExpr = hasDev ? 'dv.name' : 'NULL';
    const loginExpr = hasDev ? 'dv.login' : 'NULL';
    const botExpr = hasDev ? 'COALESCE(dv.is_bot, FALSE)' : 'FALSE';

    const pairs = await query<DayPair>(
        `SELECT rd.repo_id, rp."${c.name}" AS repo, rp."${c.url}" AS url,
            rd.dev, ${nameExpr} AS "name", ${loginExpr} AS "login",
            ${botExpr} AS is_bot, rd.num_commits AS commits
     FROM repo_day rd JOIN repos rp ON rp."${c.id}" = rd.repo_id ${idJoin}
     WHERE rd.day = ?`,
        [date],
    );

    const cohort = (
        await query<{ total: number; returning: number; fresh: number }>(
            `WITH today AS (SELECT DISTINCT dev FROM dev_day WHERE day = ?),
            prior AS (SELECT DISTINCT dev FROM dev_day WHERE day > ?::DATE - 28 AND day < ?)
     SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE p.dev IS NOT NULL) AS "returning",
            COUNT(*) FILTER (WHERE p.dev IS NULL)     AS fresh
     FROM today t LEFT JOIN prior p USING (dev)`,
            [date, date, date],
        )
    )[0] ?? { total: 0, returning: 0, fresh: 0 };

    const bounds = (
        await query<{
            prev: string | null;
            next: string | null;
            earliest: string;
            latest: string;
        }>(
            // "next" is a DuckDB reserved word — quote it (CLAUDE.md gotcha).
            `SELECT (SELECT max(day) FROM repo_day WHERE day < ?) AS prev,
            (SELECT min(day) FROM repo_day WHERE day > ?) AS "next",
            (SELECT min(day) FROM repo_day)               AS earliest,
            (SELECT max(day) FROM repo_day)               AS latest`,
            [date, date],
        )
    )[0];

    return { date, pairs, cohort, ...bounds };
}

export { loadEvents };
