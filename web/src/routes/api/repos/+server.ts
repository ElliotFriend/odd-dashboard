import { json } from '@sveltejs/kit';
import { query } from '$lib/server/db';
import type { RepoRow } from '$lib/types';
import type { RequestHandler } from './$types';

// Repo leaderboard over a trailing window: devs + commits per repo, with names.
export const GET: RequestHandler = async ({ url }) => {
  const days = Number(url.searchParams.get('days') || 28);
  const order = url.searchParams.get('by') === 'commits' ? 'commits' : 'devs';
  const rc = await query<{ name: string }>("PRAGMA table_info('repos')");
  const names = rc.map((r) => r.name);
  const idCol = names.includes('id') ? 'id' : 'repo_id';
  const urlCol = ['repo_url', 'url', 'name'].find((n) => names.includes(n)) || idCol;

  const rows = await query<RepoRow>(
    `WITH w AS (
       SELECT repo_id, count(DISTINCT dev) AS devs, sum(num_commits) AS commits,
              max(day) AS last_active_day
       FROM repo_day
       WHERE day > (SELECT max(day) FROM repo_day) - ?
       GROUP BY repo_id)
     SELECT rp."${urlCol}" AS repo, w.devs, w.commits, w.last_active_day
     FROM w LEFT JOIN repos rp ON rp."${idCol}" = w.repo_id
     ORDER BY ${order} DESC LIMIT 30`, [days]);
  return json({ rows, days, order });
};
