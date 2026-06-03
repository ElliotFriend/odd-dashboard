import { json } from '@sveltejs/kit';
import { query, meta } from '$lib/server/db';
import type { WindowedRow, DailyRow, ApiRow } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const days = Number(url.searchParams.get('days') || 120);

  // 28-day windowed metrics (the headline MAD line + single/multi split + commits)
  const windowed = await query<WindowedRow>(
    `SELECT day, all_devs, exclusive_devs, multichain_devs, num_commits
     FROM eco_mads
     WHERE day > (SELECT max(day) FROM eco_mads) - ?
     ORDER BY day`, [days]);

  // daily, un-windowed activity (the overlay that makes roll-offs legible)
  const daily = await query<DailyRow>(
    `SELECT day, daily_active_devs, daily_commits
     FROM daily_activity
     WHERE day > (SELECT max(day) FROM daily_activity) - ?
     ORDER BY day`, [days]);

  // fresher API points captured by `snapshot-api` (may extend past parquet horizon)
  let api: ApiRow[] = [];
  try {
    api = await query<ApiRow>(
      `SELECT day, total, single_chain, multi_chain FROM mau_api_history
       WHERE day > (SELECT max(day) FROM mau_api_history) - ? ORDER BY day`, [days]);
  } catch { /* table may not exist yet */ }

  return json({ windowed, daily, api, meta: await meta() });
};
