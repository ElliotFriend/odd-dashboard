# Gap-week MAD nowcast — calibration findings

**Date:** 2026-06-03 · **Verdict:** ❌ No public source reproduces ODD's MAD.
git-clone undercounts ~16–33% (variable); REST/GraphQL hit the same ref-based
ceiling; and GH Archive — tested against the real files — carries **no commit-author
data at all** (its modern `PushEvent` payload was stripped to push metadata + the
pusher). The live-week git clone is the least-bad option, but it is not trend-safe.

> **Correction (this doc's earlier draft was wrong):** it claimed GH Archive was the
> accurate "event firehose" path. We then downloaded a real week of GH Archive and
> disproved that — see "GH Archive probe" below. ODD's advantage turns out to be
> *continuous ingestion timing*, not a recoverable firehose.

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
- **GH Archive** (https://data.gharchive.org) — downloaded a full real week (May 11–17,
  168 hourly files, 4.4 GB gz) and tested it. **It carries no commit-author data.** The
  modern `PushEvent` payload is `{repository_id, push_id, ref, head, before}` — verified
  three ways: DuckDB `json_keys` (0 of 625,926 pushes have a `commits` key), the BigQuery
  schema (`payload` is an opaque `STRING`, no commit fields), and raw `json.loads`
  (payload is a dict with only those 5 keys). GitHub stripped per-commit detail out of
  the Events API. All you get per push is the **pusher** (a GitHub account) and the
  head/before SHAs.

## GH Archive probe (the disproof)

For the 29 stellar-org repos over May 11–17, GH Archive yields:

| metric | GH Archive | vs ODD |
|---|---|---|
| distinct **pushers** | 32 | vs 62–63 **authors** — and pushers are merging maintainers, the *wrong population* |
| pushes / head SHAs | 149 | (ODD: 1,046 commits) |
| authors reachable via push-head SHAs* | 29 / 63 (~46%) | *even granting a magic SHA→author resolver |

\* 121 of the 149 push-head SHAs are real ODD commits, but a push exposes only its tip
commit, so they reach <half the authors.

**Three-way comparison (29 repos, May 11–17):**

| source | distinct devs | commits/pushes | author data? |
|---|---|---|---|
| ODD (truth) | 62–63 | 1,046 | yes |
| git clone (+PR refs, crosswalk) | 52 | 721 (66% SHA) | yes (emails) |
| GH Archive | 32 pushers | 149 pushes | **none** |

**Why ODD still has commits the clone can't reach:** not recoverable force-pushes — ODD
**ingests continuously**, capturing commits while PR refs are still live, before
squash/rebase/delete. A clone run weeks later misses rewritten history. This is why
clone coverage was highest (84%) for the *freshest* week and decayed to ~67% for older
weeks — and why a *live*-week clone is the best available approximation.

## Conclusion & recommendation

- **No public source reproduces ODD's MAD.** git-clone undercounts ~16–33% (variable);
  REST/GraphQL hit the same ref-based ceiling; GH Archive has no author data at all.
- **GH Archive is *not* the answer** (this corrects the earlier draft): its modern
  payload lacks commit authorship, and its pushers (32) are the wrong population — worse
  for MAD than the clone.
- **The least-bad option is a *live*-week git clone** (+ `refs/pull/*`, + ODD's `commits`
  email→canonical crosswalk, + bot filter), run while PR refs are still fresh (~84%
  coverage). But it still undercounts, and the undercount is time-dependent (the freshest
  point reads artificially high), so **it is not safe for reading the MAD trend**.
- **Recommended: accept the ~7-day blind spot** (now described correctly in README/CLAUDE)
  rather than ship a biased nowcast.

What a live clone *could* still do honestly: a coarse, clearly-labeled "≥N devs /
something is happening" floor for spotting new repos or surges in the gap — never a MAD
figure, and never a trend line. If ever built: separate `nowcast.duckdb` / `gitfill_*`,
`source='git'`, never aliased to `canonical_developer_id`, additive-only.

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

```bash
# GH Archive disproof — confirm the payload has no commit authors:
gzcat scratch/2026-05-11-0.json.gz | python3 -c "
import sys,json
for l in sys.stdin:
    e=json.loads(l)
    if e['type']=='PushEvent':
        print(list(e['payload'].keys())); break"
# -> ['repository_id','push_id','ref','head','before']   (no 'commits')
```
