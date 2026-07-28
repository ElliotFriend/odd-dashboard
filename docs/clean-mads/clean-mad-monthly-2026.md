# Clean MAD (winget removed) — 2026 month-end series

Source: local extract built from canonical Electric Capital ODD snapshot
`20260728T125718` (horizon 2026-07-20), recomputed 2026-07-28 via
`clean_mad.py --as-of`. Each 28-day window's distinct-dev recount was validated
against `eco_mads.all_devs` (all matched exactly).

**"Clean"** = drop devs whose ONLY Stellar-repo activity in the window was
`stellar/winget-pkgs` (repo id `1770468`, fork-attribution bug — hundreds of
upstream Microsoft/winget contributors counted as Stellar devs). Anyone who also
touched a real Stellar repo is kept. See the `winget-pkgs-phantom-devs` note.

Every row here comes from ONE snapshot, so the series is internally comparable.
ODD restates history, so these numbers will drift upward as real-repo commits land
late — never mix a row from this table with a row read off a different snapshot.

## Month-end (28-day rolling window)

| month-end | official | winget-only removed | **clean MAD** | clean full_time | official commits | **clean commits** |
|---|---:|---:|---:|---:|---:|---:|
| Jan 31 | 1,393 | 0 | **1,393** | 331 | 59,228 | **59,228** |
| Feb 28 | 1,703 | 0 | **1,703** | 455 | 86,554 | **86,554** |
| Mar 31 | 1,982 | 0 | **1,982** | 476 | 86,343 | **86,343** |
| Apr 30 | 2,911 | 676 | **2,235** | 430 | 78,549 | **67,593** |
| May 31 | 2,813 | 678 | **2,135** | 359 | 58,029 | **47,262** |
| Jun 30 | 3,777 | 793 | **2,984** | 415 | 90,331 | **79,931** |
| Jul 20 (horizon) | 3,823 | 865 | **2,958** | 429 | 91,893 | **80,932** |

Jan–Mar are uncontaminated (zero winget attribution). The bug's volume onset is
**2026-04-02**, so Apr onward is contaminated. Jul 20 is the data horizon, not a
month-end, and as the freshest horizon it is an undercount.

## July month-to-date (calendar window, NOT 28-day)

| window | span | official | winget-only | **clean** |
|---|---|---:|---:|---:|
| Jul 1–20 | 2026-07-01 → 2026-07-20 | 2,246 | 744 | **1,502** |

Not comparable to the 28-day rows above — different window length.

## Drift vs the previous recompute

Re-running these same month-ends one snapshot later (`20260727T130501` →
`20260728T125718`) moved **only Jun 30**, by **+1** clean dev (2,983 → 2,984;
official 3,776 → 3,777). Jan–May were byte-identical, winget-only counts identical
on every row.

That matches the July daily series, where the same one-snapshot step moved every
horizon 07-01 → 07-19 by exactly +1: a single late-landing developer whose activity
spans June–July. It lands in the Jun-30 and July windows and in no earlier one —
which is why the earlier months didn't move at all. Restatement is **lumpy** (a few
devs at a time, hitting whichever windows their activity spans), not a smooth
per-day accrual. Full detail: `clean-mad-series-2026-07.md`.

For the earlier, larger restatements (`20260723T125457` → `20260727T130501`:
+2/+3/+6 for Jan–Mar, +8/+7 Apr/May, +17 Jun 30), see the
`winget-pkgs-phantom-devs` memory note.
