---
name: clean-mad
description: Use when the user asks for the "clean" Stellar MAD, MAD without the winget phantom devs, developer counts with the stellar/winget-pkgs fork-attribution bug removed, or a clean count / clean recount. Recomputes the 28-day MAD, commits, and contribution ranks with repo 1770468's winget-only devs dropped, prints them, and saves a dated markdown file.
---

# clean-mad

Recompute Stellar MAD with the `stellar/winget-pkgs` phantom devs removed.
`stellar/winget-pkgs` (repo id `1770468`) is a fork of Microsoft's winget-pkgs;
crypto-ecosystems attributes its hundreds of upstream package-manifest contributors
to Stellar, inflating the 28-day MAD (`all_devs`) since **2026-04-02** (volume onset — the
fork was mapped to Stellar from creation; attributed activity exploded in April). This is a bug
we expect Electric Capital to fix — **this skill is temporary; delete it once the
fork is no longer counted.** Full background: `winget-pkgs-phantom-devs` memory.

**Prerequisite:** a current extract. If the user just asked to refresh, or the extract
is stale, run the `refresh-extract` skill first.

## Run (from repo root)

```bash
uv run --no-dev python .claude/skills/clean-mad/clean_mad.py
```

- `--no-dev` because reading the extract needs only duckdb (no pandas/pytz here).
- Fast path (skip the slow canonical rank download): add `--no-ranks`.
- Point at a different extract: `--db /path/to/stellar_extract.duckdb`.
- Backfill / trend: `--as-of 2026-07-17,2026-07-18` recomputes PAST horizons (any day in
  `eco_mads`; `repo_day` holds full history so the windows are exact). One remote rank read
  covers every requested day, and a summary table prints at the end. Use `--out-dir` to write
  elsewhere when you don't want to clobber existing dated files.

It prints the summary tables AND writes `docs/clean-mads/clean-mad-<horizon>.md`
(horizon = latest `eco_mads.day`, or each `--as-of` day; the dir is created if missing).

## Where the reports live: `docs/clean-mads/`

All of it is version-controlled — these are the record of what each snapshot said.

- `clean-mad-<yyyy-mm-dd>.md` — one horizon, written on the snapshot current when it ran.
  Treat an existing dated file as an **"as first observed" baseline**: it's what the drift
  tables are measured against. When recomputing an already-written horizon just to refresh
  a trend, send it to `--out-dir <scratch>` so the baseline survives.
- `clean-mad-series-2026-07.md` — daily series, every row from ONE snapshot. The trend doc.
- `clean-mad-monthly-2026.md` — month-end series, one snapshot. Cite this for month-over-month.

## What it computes

- **MAD + commits** — local recompute from `repo_day` over the 28-day window. "Clean"
  drops devs whose ONLY window activity was repo 1770468; anyone who also touched a
  real repo stays. Distinct-devs-in-window is asserted == `eco_mads.all_devs` (sanity).
- **Contribution ranks** (full/part/one-time) — verified against the CANONICAL remote
  `eco_developer_contribution_ranks` parquet (downloads ~1 min; `--no-ranks` skips it).
- **Caveat metrics** (exclusive/multichain, tenure) — reported as-is; NOT recomputable
  from the Stellar-only extract.

## After running

- Relay the headline: clean MAD vs official, and clean full_time vs official.
- Offer to update the `winget-pkgs-phantom-devs` memory with the new horizon's numbers
  (accrual trend + full_time pollution), matching the existing per-horizon log entries.
- Do NOT blacklist the repo or add an event band unless explicitly asked.

## Common mistakes

- Running from `web/` → can't find the extract; run from repo root.
- Dropping `--no-dev` when the `dev` uv group isn't synced is fine (duckdb is in both),
  but `--no-dev` keeps it minimal/fast.
- Quoting `full_time_devs` straight from `eco_mads` as "clean" — it's polluted too;
  use this skill's rank table.
- **Building a trend by stitching dated `clean-mad-<day>.md` files together.** ODD restates
  history: the same horizon reads +26 to +45 devs higher weeks later (real-repo backfill; the
  winget-only count does NOT move). The freshest 3–4 horizons are always undercounts, so
  stitched files manufacture a fake plateau/decline. For any trend, recompute the whole range
  with one `--as-of` run. See `docs/clean-mads/clean-mad-series-2026-07.md` and the memory note.
- **Extrapolating restatement size from elapsed days.** Drift is lumpy, not ≈+2/day — one
  1-day snapshot step moved 19 consecutive July horizons by exactly +1 (a single late-landing
  dev whose activity spanned every affected window). Fresh horizons are undercounts, but the
  size of the eventual correction is not predictable.
