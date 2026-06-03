# Gap-week MAD nowcast — calibration findings

**Date:** 2026-06-03 · **Verdict:** ❌ git-clone cannot reproduce ODD's MAD. The
rate-limited GitHub REST/GraphQL APIs can't either. Only the GitHub **event
firehose** (GH Archive) tracks ODD — at the cost of bulk data, not a polite API.

## The problem we tried to solve

The public ODD parquet and developerreport.com's live (weekly) API are **both
~7 days behind today** and only ~1 day apart (verified 2026-06-03: parquet horizon
May 26, API latest May 27). So the most recent ~7 days are uncovered by any source.
We wanted to "nowcast" that gap — ideally projecting MAD and its per-repo/per-dev
breakdown before ODD publishes.

The proposed mechanism (from a prior session): `git clone --filter=blob:none --bare`
each ecosystem repo (no API rate limits, minimal disk) and derive activity from
`git log`. The full Stellar roster is **9,471 repos** (`ecosystems_repos_recursive`;
the extract's 5,945 is only repos with captured activity). Identity could be
resolved with ODD's own crosswalk — the `commits` table maps
`commit_author_email → canonical_developer_id` (+ `is_bot`).

## Calibration method

Reconstruct a **settled past week** ODD already covers and compare to ground truth.
- **Week W:** 2026-05-11 .. 2026-05-17. **Repo set R:** the 29 `github.com/stellar/*`
  repos active in W.
- **Ground truth:** ODD `repo_day` distinct devs (62) and the `commits` table
  (1,046 commits, 63 non-bot canonical devs, 87 raw emails, 133 bot commits).
- **Harvest:** clone R, `git log --all` metadata, filter to W by author date,
  dedup by SHA. Crosswalk = `email → canonical` built from `commits` **before** W
  (faithful to what we'd know going into a real gap).

## Results

| Method | commits (vs 1046) | distinct devs (vs 62) | error |
|---|---|---|---|
| A) branches only (`refs/heads/*`) | 77 (7%) | 26 | **−58%** |
| B) + `refs/pull/*` | 721 (69%) | 52 | **−16%** |

`refs/pull/*` is essential (squash-merges/feature branches aren't on `heads`).
But −16% was the *best* week. Across weeks (PR refs + crosswalk):

| week | ODD devs | git devs | error |
|---|---|---|---|
| Apr 20–26 | 52 | 35 | −33% |
| Apr 27–May 3 | 52 | 36 | −31% |
| May 4–10 | 61 | 43 | −30% |
| May 11–17 | 62 | 52 | −16% |

**~16–33% undercount, variable** → not bias-correctable with a fixed factor. (The
crosswalk even *peeks ahead* for the earlier weeks, so a faithful run is worse.)

## Where the missing devs go (the decisive decomposition)

SHA-joining ODD's commit detail against our harvest for W:

```
ODD non-bot devs in W:               63
  CAPTURED (≥1 commit harvested):    49
  LOST (zero commits captured):      14   ← the entire undercount
SHA coverage: 686/1046 = 66%   (360 ODD commits we never saw; 35 we have, ODD doesn't)
lost devs' commit counts in W: [1,1,1,2,2,2,2,2,2,3,3,3,4,4]  (11 of 14 were multi-commit)
```

The undercount is **100% "lost-commits," not identity** — all 14 missing devs had
**zero** of their commits in any fetchable ref (we already fetched branches + every
`refs/pull/*/head`). Identity resolution works fine for everyone we captured.

**Why:** ODD counts the gross GitHub push/event stream; a clone only sees the **net
surviving reachable history**. Force-pushed/rebased PR commits have SHAs ODD recorded
(from the original push) that exist in **no git ref anymore**. This is unrecoverable
by definition — the objects are gone from Git's graph.

## API probe

- **REST `list commits`** is ref-based → same force-push ceiling. For stellar-cli/W
  it returned **4 commits / 2 authors** (= clone's default branch, < clone+PR-refs's
  25/5, ≪ ODD). Rate limit 60/hr (5000 with token). So: fits limits, **doesn't track
  ODD**. Worst of both worlds.
- **GH Archive** (https://data.gharchive.org) — hourly global `PushEvent` JSON,
  including force-pushed/rebased commits. Reachable for the period (HTTP 200). This is
  almost certainly ODD's source, **not rate-limited**, but it's bulk data (~GBs/week,
  or the `githubarchive` BigQuery public dataset), not a per-repo API.

## Conclusion & recommendation

- **Do not build a git-clone MAD nowcast.** It has a hard ~30% (variable) dev
  undercount that no cloning/identity cleverness fixes.
- **The rate-limited REST/GraphQL APIs don't fix it either** (same ref-based ceiling).
- **If a gap-week MAD nowcast is worth real effort, the path is GH Archive** (the event
  firehose / BigQuery `githubarchive`), reconciled to canonical IDs via ODD's `commits`
  crosswalk — and even then, kept strictly separate from ODD tables and labeled an
  estimate (separate `nowcast.duckdb` / `gitfill_*`, `source='git'`, never aliased to
  `canonical_developer_id`, additive-only).
- **Otherwise, accept the ~7-day blind spot** (now described correctly in README/CLAUDE).

What clone *could* still do honestly: a coarse, clearly-labeled "≥N devs / something is
happening" floor for spotting new repos or surges in the gap — never a MAD figure.

## Reproduce

```bash
# ground truth (local, instant):
duckdb stellar_extract.duckdb "SELECT count(DISTINCT dev) FROM repo_day
  WHERE repo_id IN (SELECT id FROM repos WHERE link ILIKE 'https://github.com/stellar/%')
    AND day BETWEEN DATE '2026-05-11' AND DATE '2026-05-17'"

# harvest one repo with PR refs:
git clone --filter=blob:none --bare https://github.com/stellar/stellar-cli.git r.git
git -C r.git config --add remote.origin.fetch '+refs/pull/*/head:refs/pull/*/head'
git -C r.git fetch --filter=blob:none origin
git -C r.git log --all --pretty='%H%x09%ae%x09%aI' | awk -F'\t' '$3>="2026-05-11" && $3<"2026-05-18"'
```
ODD's commit detail + crosswalk come from `read_parquet(<manifest commits.parquet>)`
filtered to the repo set (see `stellar_odd.py` `load_manifest`).
