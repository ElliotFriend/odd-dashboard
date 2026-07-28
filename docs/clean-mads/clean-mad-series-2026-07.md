# Clean MAD daily series — July 2026 (single snapshot `20260728T125718`)

Every row recomputed from ONE extract (snapshot `20260728T125718`, horizon 2026-07-20),
so the series is internally consistent. Method identical to the `clean-mad` skill: 28-day
window ending on `horizon`; "clean" drops devs whose ONLY window activity was
`stellar/winget-pkgs` (repo id `1770468`). Verified: distinct-dev recount == `eco_mads.all_devs`
for all 20 days, zero mismatches. Ranks canonical-verified against
`eco_developer_contribution_ranks` (ecosystem_id=7) at the same snapshot.

| horizon | official MAD | winget-only | **clean MAD** | clean full_time |
|---|---:|---:|---:|---:|
| 2026-07-01 | 3,770 | 788 | **2,982** | 424 |
| 2026-07-02 | 3,779 | 792 | **2,987** | 428 |
| 2026-07-03 | 3,784 | 793 | **2,991** | 435 |
| 2026-07-04 | 3,784 | 796 | **2,988** | 439 |
| 2026-07-05 | 3,792 | 795 | **2,997** | 439 |
| 2026-07-06 | 3,799 | 805 | **2,994** | 447 |
| 2026-07-07 | 3,826 | 824 | **3,002** | 456 |
| 2026-07-08 | 3,847 | 839 | **3,008** | 455 |
| 2026-07-09 | 3,837 | 828 | **3,009** | 454 |
| 2026-07-10 | 3,837 | 830 | **3,007** | 459 |
| 2026-07-11 | 3,824 | 813 | **3,011** | 457 |
| 2026-07-12 | 3,825 | 813 | **3,012** | 451 |
| 2026-07-13 | 3,819 | 812 | **3,007** | 448 |
| 2026-07-14 | 3,844 | 834 | **3,010** | 451 |
| 2026-07-15 | 3,875 | 858 | **3,017** | 444 |
| 2026-07-16 | 3,844 | 847 | **2,997** | 419 |
| 2026-07-17 | 3,834 | 852 | **2,982** | 418 |
| 2026-07-18 | 3,826 | 851 | **2,975** | 418 |
| 2026-07-19 | 3,815 | 849 | **2,966** | 421 |
| 2026-07-20 | 3,823 | 865 | **2,958** | 429 |

Shape: rises ≈2,982 (Jul 1) → peak ≈3,017 (Jul 15), then the 07-16 → 07-20 slide to 2,958.
That tail slide is **incompleteness, not decline** — see below.

## ODD restates history — do NOT compare across snapshots

The per-horizon `clean-mad-<day>.md` files were each written from the snapshot current on the
day they ran. Re-running the same horizons later gives materially HIGHER clean MAD.

Restated against `20260727T130501` (previous run of this doc):

| horizon | clean, as first observed | clean, restated 07-27 | Δ | days of backfill |
|---|---:|---:|---:|---:|
| 2026-07-03 | 2,949 | 2,990 | **+41** | ~21 |
| 2026-07-05 | 2,951 | 2,996 | **+45** | ~19 |
| 2026-07-06 | 2,948 | 2,993 | **+45** | ~18 |
| 2026-07-07 | 2,958 | 3,001 | **+43** | ~17 |
| 2026-07-12 | 2,980 | 3,011 | **+31** | ~12 |
| 2026-07-13 | 2,972 | 3,006 | **+34** | ~11 |
| 2026-07-14 | 2,976 | 3,009 | **+33** | ~10 |
| 2026-07-15 | 2,984 | 3,016 | **+32** | ~9 |
| 2026-07-16 | 2,970 | 2,996 | **+26** | ~3 |

- The drift is **entirely real-repo dev backfill**: winget-only counts are byte-identical
  then vs now (795 / 805 / 824 / 813 / 812 / 834 / 858 / 847). The bug isn't growing —
  genuine Stellar activity keeps landing late.
- **Consequence:** the freshest 3–4 horizons are systematically UNDERCOUNTED. The apparent
  07-16 → 07-20 decline in the series table is an incompleteness artifact, not a real drop.
- **Consequence:** an earlier read of "clean MAD flat ≈2,970 across seven horizons" was a
  cross-snapshot artifact. On one snapshot the July series RISES, then flattens once the
  incomplete tail is excluded.

### Restatement is lumpy, not a smooth per-day accrual (added 2026-07-28)

`20260727T130501` → `20260728T125718` (one snapshot, one day) moved **every** horizon
07-01 → 07-19 by exactly **+1** clean dev, and by +1 official dev, with winget-only counts
unchanged on all 19 rows. A uniform +1 across a 19-day span of independent 28-day windows is
one late-landing developer whose activity spans June–July, not broad backfill.

So don't model drift as ≈+2/day: the +26…+45 figures above accumulated in a few lumpy
restatements, and a given snapshot-to-snapshot step can be as small as +1. A fresh horizon's
number is still an undercount — just don't extrapolate the size of the eventual correction
from elapsed days alone.

Rule: for trend claims, always recompute the whole series from a single snapshot
(`clean_mad.py --as-of <comma-separated days>`), never stitch dated files together.
