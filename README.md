# Stellar ODD Dashboard

Local dashboard + standalone analysis script for **Stellar** developer activity,
built on Electric Capital's **Open Dev Data** (ODD) parquet dataset.

> Source: **Open Dev Data by Electric Capital** —
> https://github.com/electric-capital/open-dev-data — CC BY 4.0

## What's here

- **`stellar_odd.py`** — standalone CLI (DuckDB). Reads remote parquet over HTTP
  range requests, isolates **only Stellar**, and writes a small
  `stellar_extract.duckdb` (tens of MB, not the ~47 GB full dataset).
  - `extract` — build/refresh the extract.
  - `diagnose` — explain MAU movements (daily-vs-windowed, surge detection,
    cohort exit schedule, repos that drove a period then went silent).
  - `snapshot-api` — append the live developerreport.com MAU series so you
    capture recent points *before* the public parquet catches up (it trails ~7d).
- **SvelteKit app** (in [`./web`](./web)) — reads `stellar_extract.duckdb` server-side
  and renders the MAU-vs-daily overlay, single/multi split, commit totals, and a
  repo leaderboard.

## Key concepts (confirmed against the ODD data dictionary)

- **MAD / "MAU"** = developers with ≥1 commit in a **28-day rolling window**
  (`eco_mads.all_devs`). `all_devs = exclusive_devs + multichain_devs`.
- `eco_mads.num_commits` is **also 28-day windowed**.
- Contribution ranks (`full_time/part_time/one_time_devs`) use an **84-day** window.
- Tenure (`devs_0_1y/1_2y/2y_plus`) is by first blockchain commit.
- The public parquet trails the live API by ~7 days — hence `snapshot-api`.

## Quick start

Prereqs: [`uv`](https://docs.astral.sh/uv/) (Python) and [`pnpm`](https://pnpm.io/) (JS).

```bash
# 1) build the Stellar extract (run wherever data.opendevdata.org is reachable)
#    `uv run` syncs the locked deps (duckdb) into .venv automatically.
uv run python stellar_odd.py extract --out ./stellar_extract.duckdb
uv run python stellar_odd.py snapshot-api --db ./stellar_extract.duckdb   # optional, recommended

# 2) run the dashboard (the SvelteKit app lives in ./web)
cd web
pnpm install
STELLAR_DB=../stellar_extract.duckdb pnpm dev     # http://localhost:5173
```

The extract is built at the repo root; the app reads it via `STELLAR_DB`
(`../stellar_extract.duckdb` from inside `./web`). Set `STELLAR_DB` to point elsewhere.

## Investigate a MAU move (e.g. the May 2026 drop)

```bash
python stellar_odd.py diagnose --as-of 2026-05-19 \
    --surge-from 2026-04-22 --surge-to 2026-04-29
```

## Scheduling (keep it fresh + catch troughs early)

`crontab -e`:

```cron
# refresh the Stellar extract daily at 14:10 UTC (after EC's daily publish)
10 14 * * *  cd /path/to/proj && uv run python stellar_odd.py extract --out ./stellar_extract.duckdb >> extract.log 2>&1
# snapshot the live API every Monday (your weekly MAU tracking)
0 13 * * 1   cd /path/to/proj && uv run python stellar_odd.py snapshot-api --db ./stellar_extract.duckdb >> api.log 2>&1
```

A GitHub Actions equivalent lives in `.github/workflows/refresh.yml`.

## Notes / gotchas

- The extract opens READ_ONLY in the app, so a scheduled `extract` won't lock it.
- Column names are introspected at runtime, so minor ODD schema changes won't break it.
- `repo_developer_activities` counts a dev on every repo they touch, so per-repo
  `devs` sums over-count people who worked on multiple repos — fine for ranking,
  not a partition of the total.
