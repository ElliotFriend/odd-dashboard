import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import type { CohortRow, Intensity, SurgeDay } from '$lib/types';
import type { RequestHandler } from './$types';

// "What moved the metric": cohort/recurring split, contributor intensity, surges.
export const GET: RequestHandler = async ({ url }) => {
  const W = 28;
  const R = Math.max(60, Math.min(400, Number(url.searchParams.get('days') || 120)));

  // Rolling cohort split: recurring = active in current 28d window AND prior 28d window.
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

  // Contributor intensity for the current window (low => drive-by/program; high => sustained).
  const intensity = (await query<Intensity>(`
    SELECT SUM(num_commits) AS commits, COUNT(DISTINCT dev) AS devs,
           ROUND(SUM(num_commits)*1.0/NULLIF(COUNT(DISTINCT dev),0), 2) AS commits_per_dev
    FROM dev_day WHERE day > (SELECT max(day) FROM dev_day) - ${W}`))[0] ?? {};

  // Daily surge days (vs trailing-90d median); JS clusters contiguous runs.
  const surgeDays = await query<SurgeDay>(`
    WITH d AS (SELECT day, daily_active_devs,
        median(daily_active_devs) OVER (ORDER BY day RANGE BETWEEN 90 PRECEDING AND 1 PRECEDING) AS base
      FROM daily_activity)
    SELECT day, daily_active_devs AS devs, base FROM d
    WHERE base IS NOT NULL AND daily_active_devs > 2*base
      AND day > (SELECT max(day) FROM daily_activity) - ${R}
    ORDER BY day`);

  return json({ cohort, intensity, surgeDays, window: W });
};
