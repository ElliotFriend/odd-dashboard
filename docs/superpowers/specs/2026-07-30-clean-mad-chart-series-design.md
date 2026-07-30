# Clean MAD chart series — design

Date: 2026-07-30

## Problem

`stellar/winget-pkgs` (repo id `1770468`) is a fork of Microsoft's winget-pkgs
sitting under the `stellar/` GitHub org, so crypto-ecosystems attributes its
upstream package-manifest contributors to Stellar. Since 2026-04-02 this has
inflated the 28-day MAD (`eco_mads.all_devs`) by hundreds of developers — 889 of
3,833 at the 2026-07-22 horizon, 23% of the headline number.

Today the only way to see the corrected figure is to run the `clean-mad` skill
and read a dated markdown report. The dashboard chart shows the inflated series
with no indication that a quarter of it is a fork-attribution artifact.

## Goal

Put the corrected series on the chart, computed live from the extract — not read
from the reports or the memory file. A reader should see both the official line
and the clean line, and the gap between them.

## Scope

Chart only. Stat cards, repo/dev leaderboards, WhatMoved, and the drill-down
pages continue to show official numbers. No `events.json` change, no repo
blacklist.

This is a **temporary** feature. Electric Capital is expected to fix the
attribution; when they do, the series collapses onto the official line and the
whole thing should be deleted. The implementation is structured so that removal
is one block plus its call sites.

## Definition of "clean"

Drop a developer from the window only if `stellar/winget-pkgs` was their **only**
activity in that window. A developer who touched the fork *and* a real repo is
kept, with all their commits.

This is dev-level, not repo-level — `WHERE repo_id <> 1770468` would be wrong,
because it would strip a real contributor's fork commits while still counting
them as active, and would silently change what the number means.

At every horizon computed so far the overlap set has been empty (all 889 winget
touchers at 2026-07-22 were winget-only), but the rule is what the `clean-mad`
skill and every report in `docs/clean-mads/` use, so the dashboard must match it.

## Data layer — `web/src/lib/server/queries.ts`

A single delimited block, per the project convention that all SQL lives in this
file:

```ts
/** TEMPORARY: stellar/winget-pkgs (repo 1770468) is a fork of Microsoft's
 *  winget-pkgs; crypto-ecosystems attributes its upstream contributors to
 *  Stellar. Delete this block + its call sites once EC stops counting it. */
const PHANTOM_REPO_ID = 1770468;
```

`getMad(days)` gains two outputs.

### Rolling 28-day phantom count

Returned as `phantom: PhantomRow[]` where `PhantomRow = { day: string; devs: number }`.
Rows with `devs = 0` are filtered out server-side. Only 198 days in the entire
history have any fork activity inside the 28-day window (first fork commit
2024-11-20), and only 112 of those have a nonzero winget-only count, so this
array stays small at any range. Bounded by `days` like the other series.

```sql
WITH cand AS (SELECT DISTINCT dev FROM repo_day WHERE repo_id = ?),
 wd AS (SELECT DISTINCT dev, day FROM repo_day WHERE repo_id = ?),
 od AS (SELECT DISTINCT r.dev, r.day FROM repo_day r JOIN cand USING (dev)
        WHERE r.repo_id <> ?),
 anchors AS (SELECT day AS d FROM eco_mads
             WHERE day >= (SELECT min(day) FROM wd)
               AND day > (SELECT max(day) FROM eco_mads) - ?),
 hasw AS (SELECT a.d, wd.dev FROM anchors a
          JOIN wd ON wd.day > a.d - 28 AND wd.day <= a.d GROUP BY 1, 2),
 haso AS (SELECT a.d, od.dev FROM anchors a
          JOIN od ON od.day > a.d - 28 AND od.day <= a.d GROUP BY 1, 2)
SELECT hasw.d AS day, count(*) FILTER (WHERE haso.dev IS NULL) AS devs
FROM hasw LEFT JOIN haso ON haso.d = hasw.d AND haso.dev = hasw.dev
GROUP BY 1 HAVING devs > 0 ORDER BY 1
```

Restricting `cand` to developers who ever touched the fork keeps both rolling
joins tiny. Measured at 0.04s over the full 4,221-day series against the current
extract (`repo_day` is 462k rows).

Verified output: 889 at 2026-07-22, 891 at 07-21, 865 at 07-20 — matching
`docs/clean-mads/clean-mad-2026-07-{22,21,20}.md` exactly. The `HAVING devs > 0`
alias reference was run against the extract and DuckDB accepts it; `svelte-check`
cannot catch SQL-string errors, so this was confirmed by execution rather than
assumed.

### Per-day phantom count

`DailyRow` gains `winget_only_devs: number`. `daily_active_devs` is unchanged and
remains the total, so nothing downstream of the existing field shifts meaning.

```sql
WITH f AS (
  SELECT day, dev,
         max(CASE WHEN repo_id <> ? THEN 1 ELSE 0 END) AS other
  FROM repo_day GROUP BY 1, 2)
SELECT day, count(*) FILTER (WHERE other = 0) AS winget_only_devs
FROM f GROUP BY 1
```

LEFT JOINed onto the existing `daily_activity` query with `COALESCE(..., 0)`.
Measured at 0.01s. Verified: 2026-07-22 splits 483 total into 399 real + 84
phantom.

### Types — `web/src/lib/types.ts`

- New `PhantomRow { day: string; devs: number }`.
- `MadResponse` gains `phantom: PhantomRow[]`.
- `DailyRow` gains `winget_only_devs: number`.

`/api/mad` wraps `getMad` and picks the new fields up with no change.

## Chart component — `web/src/lib/components/Chart.svelte`

`ChartBars` gains an optional top segment:

```ts
export interface ChartBars {
    name: string;
    color: string;
    data: ChartPoint[];
    /** Optional TOP segment of a stacked bar. `data` above remains the TOTAL. */
    stack?: { name: string; color: string; data: ChartPoint[] };
}
```

Keeping `data` as the total is deliberate: the y-max computation, the hover
readout, and every existing caller stay untouched, and a chart with no `stack`
renders byte-identically to today.

Bar rendering: when a day has a `stack` value `s` and total `t`, draw two rects —
top from `y(t)` to `y(t - s)` in the stack color, bottom from `y(t - s)` to
`y(0)` in the base color. Otherwise draw the single rect as today. Both segments
keep the existing 0.28 opacity, x position, and width.

## Dashboard chart — `web/src/lib/components/MadChart.svelte`

- Build a `Map<day, devs>` from `mad.phantom` (sliced by the active range like
  the other series).
- Insert a second line directly after `MAD (28d)`:
  `{ name: 'MAD (28d, clean)', color: 'var(--amber)', dash: '6 3',
     data: wWindowed.map(d => ({ day: d.day, value: d.all_devs - (map.get(d.day) ?? 0) })) }`.
  Computing client-side from the official series means the clean line spans the
  full chart and lies exactly on the official line for every pre-fork day, rather
  than starting abruptly in Nov 2024.
- `bars.stack = { name: 'winget-pkgs fork', color: 'var(--muted)',
   data: wDaily.map(d => ({ day: d.day, value: d.winget_only_devs })) }`.
- Readout: the clean line is picked up automatically by the existing
  `lines.map(...)`; the stack segment needs one appended row, mirroring how
  `bars` is appended today.
- The explanatory `<p class="note">` gains a sentence on what the dashed line is.

Resulting readout at the current horizon:

```
● MAD (28d)          3,833
● MAD (28d, clean)   2,944
● single-chain       2,688
● multi-chain        1,145
▮ daily active         483
▮ winget-pkgs fork      84
```

## Glossary — `web/src/lib/components/Definitions.svelte`

Two entries appended to `terms[]`, colors matching the chart:

- **MAD (28d, clean)** — amber dot. 28-day MAD with developers whose only
  activity was the `stellar/winget-pkgs` fork removed; notes that a developer who
  also touched a real repo is kept.
- **winget-pkgs fork** — grey dot. What the fork is, why its contributors are
  attributed to Stellar, and that the segment is expected to disappear once
  Electric Capital corrects the attribution.

## Removal

When Electric Capital fixes the attribution, delete: the `PHANTOM_REPO_ID` block
and its two queries in `queries.ts`, the `phantom` field and `winget_only_devs`
from `types.ts`, the clean line and `bars.stack` in `MadChart.svelte`, the two
glossary entries, and the `stack` support in `Chart.svelte`.

## Verification

The repo has no test framework, so verification is type-check, lint, and a
numeric check against the committed reports.

1. `cd web && pnpm check` — clean.
2. `cd web && pnpm lint` — clean.
3. `cd web && STELLAR_DB=../stellar_extract.duckdb pnpm dev`, then on the
   dashboard hover 2026-07-22 and confirm the readout reads official 3,833,
   clean 2,944, daily active 483, winget-pkgs fork 84 — cross-checked against
   `docs/clean-mads/clean-mad-2026-07-22.md`.
4. Hover a day before 2024-11-20 and confirm the clean line equals the official
   line (no phantom rows exist, so the values must be identical).
5. Select the `all` range and confirm the full series still renders and the two
   lines separate only from April 2026 onward.
