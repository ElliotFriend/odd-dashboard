# Stellar ODD — project context for Claude Code

Analytics for **Stellar** developer activity built on Electric Capital's
**Open Dev Data (ODD)** parquet dataset. A standalone Python/DuckDB CLI builds a
small Stellar-only extract; a SvelteKit app reads it.

> Attribution (required, CC BY 4.0): "Open Dev Data by Electric Capital",
> https://github.com/electric-capital/open-dev-data , CC BY 4.0.

@README.md

## Goal
Answer questions about Stellar devs (who, which repos, commits, classifications,
geography) for all-time or trailing windows, and explain movements in the
28-day "Monthly Active Developers" (MAD/MAU) metric.

## Data source & access
- Manifest (always current snapshot): https://data.opendevdata.org/manifest.json
- Files live at `/snapshots/<VERSION>/<table>.parquet`; the manifest `version`
  field changes ~daily. NEVER hardcode the version — read it from the manifest.
- The full dataset is ~47 GB (commits.parquet alone ~20 GB). We do NOT download it.
  DuckDB `httpfs` reads remote parquet via HTTP range requests; we filter to
  Stellar's `ecosystem_id` and write only Stellar rows into `stellar_extract.duckdb`.
- ~7-day publish lag: the public parquet trails developerreport.com's live API by
  about a week. `snapshot-api` captures the fresher API points so recent troughs
  aren't missed.

## Confirmed schema (verified against the June 2026 snapshot + the ODD architecture page)
- `ecosystems(id, name, ...)` — Stellar is `name = 'Stellar'`; join key is `id`.
- `eco_mads(ecosystem_id, day DATE, all_devs, exclusive_devs, multichain_devs,
  num_commits, devs_0_1y, devs_1_2y, devs_2y_plus,
  full_time_devs, part_time_devs, one_time_devs)` — the presentation table.
  ALL of these are **28-day rolling-window** values (including `num_commits`).
- `eco_developer_activities(ecosystem_id, day, canonical_developer_id, num_commits)`
  — **daily, un-windowed** per-dev activity.
- `repo_developer_activities(ecosystem_id, day, repo_id, canonical_developer_id, num_commits)`
  — daily per-repo-per-dev.
- `repos(id, repo_url, ...)` — join `repos.id = repo_developer_activities.repo_id`.

### Definitions / invariants
- MAD ("MAU") = developers with ≥1 commit in the **28-day** rolling window (`all_devs`).
- Invariant: `all_devs = exclusive_devs + multichain_devs` (use it as a validation check).
- `exclusive_devs` ≈ "single-chain" but precisely = contributed to a first-party-org
  repo of this ecosystem OR only this ecosystem's repos within the 28d window.
- Contribution ranks (`full_time/part_time/one_time_devs`) use an **84-day** window.
- Tenure buckets are by first-ever blockchain commit date.

## The CLI: `stellar_odd.py`
- `extract`  — build/refresh `stellar_extract.duckdb` (Stellar slices only).
- `diagnose` — daily-vs-windowed table, surge auto-detection, cohort exit schedule,
  and "repos active in a window but silent since" anti-join.
- `snapshot-api` — upsert developerreport.com MAU series into the extract (idempotent).

## The dashboard (SvelteKit, Svelte 5 runes, TypeScript) — lives in `web/`
- `web/src/lib/server/db.ts` opens the extract READ_ONLY (so a scheduled `extract`
  won't lock it). BigInt/Date values are normalized there.
- Shared data shapes live in `web/src/lib/types.ts` (chart series + `/api/*` payloads);
  endpoints type their `query<T>(...)` rows against them.
- Routes: `/api/mau`, `/api/repos`, `/api/diagnose`. Page: `web/src/routes/+page.svelte`.
- `Chart.svelte` is dependency-free SVG. Marquee view = 28d-windowed MAD line with
  faint DAILY-active bars behind it, so roll-offs read as roll-offs, not cliffs.
- Run: `cd web && STELLAR_DB=../stellar_extract.duckdb pnpm dev` (JS via pnpm; Python
  CLI at repo root via `uv run`). The extract is built at the repo root; `db.ts`
  defaults to `./stellar_extract.duckdb`, so set `STELLAR_DB` when running from `web/`.
- Type-check with `pnpm check` (runs `svelte-kit sync && svelte-check`).
- Gotcha (fixed): the `sveltekit` Vite plugin comes from `@sveltejs/kit/vite`,
  NOT `@sveltejs/vite-plugin-svelte` (that exports `svelte`).

## Investigation result (the founding use case — keep this context)
The May 19→26 2026 MAU drop (1,676 → 1,075 on developerreport.com) was NOT an exodus.
It is the mechanical roll-off of an **April 22–29 activity surge** aging out of the
28-day window (~28-day delay). Evidence, four ways:
1. Daily activity spiked Apr 22–29 (peak ~692 devs/day vs ~120 baseline), back to
   baseline by May 1.
2. The windowed `all_devs` declined day-by-day exactly as surge days left the window.
3. Cohort exit schedule: ~72% of the May-19 window's devs were last-active in the
   two surge weeks.
4. Repo attribution: dozens of new project repos (-contracts/-frontend/-backend
   triplets) ending cleanly on Apr 29.
The surge was a **grant/bounty program**, not a hackathon and not a bootcamp:
~2–7 commits/dev across 40–63 devs per repo, and cross-repo overlap showed many
contributors touching 3–33 repos in one week (bounty-farming signature).
**Confirmed: Drips Wave 4**, the Stellar Wave bounty sprint that ran **Apr 22–29 2026**
— https://www.drips.network/wave/stellar . Drips Wave is a recurring ~one-week-per-month
"Fix, Merge, Earn" bounty cycle (launched with SDF Jan 2026); the surge dates line up
exactly. Rise In (bootcamps) ruled out by the per-repo swarm signature. Stellar's
recurring base ≈ 1,000–1,100; programs transiently inflate MAU above it.

NOTE on platforms (an earlier draft conflated these): **Drips Wave** and **GrantFox**
are *separate, parallel* contributor platforms — both filling the gap OnlyDust left
when it exited Web3 — NOT one built on the other. The Apr surge was Drips Wave;
GrantFox is unrelated to it.

## Gotchas
- `repo_developer_activities` counts a dev on EVERY repo they touch — summing per-repo
  `devs` over-counts people on multiple repos. Fine for ranking, not a partition.
- `start`/`end` are reserved words in DuckDB — alias as `min_day`/`max_day`.
- Reading the extract via the **Python** duckdb client needs `pytz` (+ `numpy`/`pandas`
  for `.fetchdf()`) to materialize the `meta.extracted_at` TIMESTAMPTZ — they're in the
  uv `dev` group, so `uv run python` has them; CI runs `uv run --no-dev` (duckdb only).
  The dashboard's Node client is unaffected.
- Column names are introspected at runtime in the CLI; prefer that over hardcoding.

## Open next steps
- "First-ever Stellar commit during the window?" flag → label surges as
  new-contributor-driven vs returning-bounty-hunter-driven automatically.
- Tenure + full/part/one-time classification page (data already in `eco_mads`).
- ~~Pin the exact April 2026 Drips Wave dates~~ — DONE: confirmed Drips Wave 4, Apr 22–29 2026.
