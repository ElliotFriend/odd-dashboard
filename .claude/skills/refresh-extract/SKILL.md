---
name: refresh-extract
description: Use when the user wants to rebuild/refresh the Stellar ODD DuckDB extract, pull the latest snapshot, or update the data before looking at MAD numbers or the dashboard. Runs the two README extract commands (extract then snapshot-api) sequentially from the repo root.
---

# refresh-extract

Rebuild `stellar_extract.duckdb` from the latest Electric Capital ODD snapshot,
then upsert the developerreport.com MAD series. These are the two commands from
the README, run **sequentially** — the second only if the first succeeds.

## Run (from repo root)

```bash
uv run python stellar_odd.py extract --out ./stellar_extract.duckdb && \
uv run python stellar_odd.py snapshot-api --db ./stellar_extract.duckdb
```

- Must run from the repo root (where `stellar_odd.py` and `stellar_extract.duckdb` live).
- `extract` reads remote parquet over HTTP range requests — takes a few minutes,
  network-dependent. Do NOT hardcode the snapshot version; the CLI reads the manifest.
- `snapshot-api` is idempotent (upsert); safe to re-run. It's a cross-check, ~1 day
  fresher than the parquet — not a gap-filler.
- `&&` ensures snapshot-api runs only on a clean extract.

## After it finishes

- Report the new horizon: latest `eco_mads.day` and the snapshot version (`meta` table).
- The dashboard opens the extract READ_ONLY, so a refresh won't lock it — but a running
  `db.ts` caches its connection; **restart the dashboard** to see new data.
- Refreshing data usually precedes a clean MAD recount — see the `clean-mad` skill.

## Common mistakes

- Running from `web/` instead of repo root → CLI can't find `stellar_odd.py`.
- Using `;` instead of `&&` → snapshot-api runs even if extract failed, on stale data.
