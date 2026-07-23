#!/usr/bin/env python
"""Compute "clean" Stellar MAD with the stellar/winget-pkgs phantom devs removed.

Background: repo id 1770468 (stellar/winget-pkgs) is a fork of Microsoft's
winget-pkgs. Crypto-ecosystems' fork attribution maps its ~hundreds of upstream
package-manifest contributors to Stellar, inflating the 28-day MAD (all_devs)
since ~2026-06-17. This is a bug we expect Electric Capital to fix eventually; until
then a "clean" count drops devs whose ONLY window activity was that repo (anyone
who also touched a real repo stays).

Method (mirrors the hand-verified session recompute):
  - MAD + commits: recomputed locally from `repo_day` over the 28-day window
    ending at the latest `eco_mads.day`. Distinct-devs-in-window is asserted to
    equal `eco_mads.all_devs` exactly (sanity check).
  - Contribution ranks (full/part/one-time): verified against the CANONICAL remote
    `eco_developer_contribution_ranks` parquet (ecosystem_id=7, horizon day),
    intersected with the winget-only dev set. Needs httpfs + network; the whole
    parquet downloads (~1 min). Skip with --no-ranks for a fast local-only run.

Writes clean-mad-<horizon>.md next to the extract and prints a summary.

Usage (from repo root):
  uv run --no-dev python .claude/skills/clean-mad/clean_mad.py
  uv run --no-dev python .claude/skills/clean-mad/clean_mad.py --db ./stellar_extract.duckdb --no-ranks
"""
import argparse
import os
import sys
from collections import defaultdict

import duckdb

WINGET_REPO_ID = 1770468
STELLAR_ECOSYSTEM_ID = 7
MANIFEST_URL = "https://data.opendevdata.org/manifest.json"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default="./stellar_extract.duckdb", help="path to the extract")
    ap.add_argument("--out-dir", default=None, help="where to write the markdown (default: next to the db)")
    ap.add_argument("--no-ranks", action="store_true", help="skip the slow canonical remote rank verification")
    args = ap.parse_args()

    if not os.path.exists(args.db):
        sys.exit(f"extract not found: {args.db} (run the refresh-extract skill first, from repo root)")

    loc = duckdb.connect(args.db, read_only=True)

    version = loc.execute("select snapshot_version from meta").fetchone()[0]
    H = loc.execute("select max(day) from eco_mads").fetchone()[0]
    lo = loc.execute("select (max(day) - INTERVAL 27 DAY)::DATE from eco_mads").fetchone()[0]

    m = loc.execute(
        "select all_devs, num_commits, full_time_devs, part_time_devs, one_time_devs, "
        "exclusive_devs, multichain_devs, devs_0_1y, devs_1_2y, devs_2y_plus "
        "from eco_mads where day = ?", [H]
    ).fetchone()
    (off_all, off_commits, off_ft, off_pt, off_ot,
     exclusive, multichain, d01, d12, d2p) = m

    # --- local recompute: MAD + commits over the 28d window ---
    total = loc.execute(
        "select count(distinct dev) from repo_day where day between ? and ?", [lo, H]
    ).fetchone()[0]
    winget_touch = loc.execute(
        "select count(distinct dev) from repo_day where day between ? and ? and repo_id = ?",
        [lo, H, WINGET_REPO_ID],
    ).fetchone()[0]
    winget_only_ids = set(r[0] for r in loc.execute(
        """select dev from repo_day where day between ? and ?
           group by dev
           having sum(case when repo_id <> ? then 1 else 0 end) = 0
              and sum(case when repo_id = ? then 1 else 0 end) > 0""",
        [lo, H, WINGET_REPO_ID, WINGET_REPO_ID],
    ).fetchall())
    winget_only = len(winget_only_ids)
    clean_mad = total - winget_only

    tot_c = loc.execute(
        "select sum(num_commits) from repo_day where day between ? and ?", [lo, H]
    ).fetchone()[0]
    wing_c = loc.execute(
        "select sum(num_commits) from repo_day where day between ? and ? and repo_id = ?",
        [lo, H, WINGET_REPO_ID],
    ).fetchone()[0]
    tot_c, wing_c = int(tot_c), int(wing_c)

    daily = loc.execute(
        """select day, count(distinct dev) d, sum(num_commits) c
           from repo_day where repo_id = ? and day between ? and ?
           group by day order by day desc limit 10""",
        [WINGET_REPO_ID, lo, H],
    ).fetchall()

    # sanity: local distinct-devs must equal the presentation table's all_devs
    if total != off_all:
        print(f"WARNING: local distinct devs {total} != eco_mads.all_devs {off_all} "
              "(schema drift? investigate before trusting the clean number)", file=sys.stderr)

    # --- canonical remote rank verification (optional, slow) ---
    ranks = None
    if not args.no_ranks:
        try:
            rc = duckdb.connect()
            rc.execute("install httpfs; load httpfs;")
            base = f"https://data.opendevdata.org/snapshots/{version}/eco_developer_contribution_ranks.parquet"
            rows = rc.execute(
                "select contribution_rank, canonical_developer_id from read_parquet(?) "
                "where ecosystem_id = ? and day = ?",
                [base, STELLAR_ECOSYSTEM_ID, H],
            ).fetchall()
            byrank = defaultdict(set)
            for rank, dev in rows:
                byrank[rank].add(dev)
            ranks = {}
            for k in ("full_time", "part_time", "one_time"):
                off = len(byrank[k])
                w = len(byrank[k] & winget_only_ids)
                ranks[k] = (off, w, off - w)
        except Exception as e:
            print(f"WARNING: canonical rank verification failed ({e}); writing without ranks.",
                  file=sys.stderr)
            ranks = None

    md = render(H, lo, version, off_all, total, winget_touch, winget_only, clean_mad,
                tot_c, wing_c, daily, ranks, off_ft, off_pt, off_ot,
                exclusive, multichain, d01, d12, d2p)

    out_dir = args.out_dir or os.path.dirname(os.path.abspath(args.db))
    out_path = os.path.join(out_dir, f"clean-mad-{H}.md")
    with open(out_path, "w") as f:
        f.write(md)

    print(md)
    print(f"\n--- written to {out_path} ---", file=sys.stderr)


def render(H, lo, version, off_all, total, winget_touch, winget_only, clean_mad,
           tot_c, wing_c, daily, ranks, off_ft, off_pt, off_ot,
           exclusive, multichain, d01, d12, d2p):
    pct_mad = 100 * winget_only / off_all
    pct_commits = 100 * wing_c / tot_c
    sanity = "matches" if total == off_all else f"MISMATCH ({total})"

    lines = [
        f"# Clean MAD (winget removed) — horizon {H}",
        "",
        f"Canonical snapshot `{version}`; latest `eco_mads.day` = **{H}**. "
        f"28-day window = {lo} → {H} inclusive.",
        "",
        f"Sanity check: distinct devs over the window across all repos = **{total:,}**, "
        f"{sanity} `eco_mads.all_devs`. \"Clean\" = drop devs whose ONLY window activity was "
        f"`stellar/winget-pkgs` (repo id `{WINGET_REPO_ID}`, fork-attribution bug — see "
        "`winget-pkgs-phantom-devs` memory); anyone who also touched a real repo stays.",
        "",
        "## Cleanly recomputed from the extract (`repo_day`, 28d window)",
        "",
        "| metric | official | winget-only | **clean** |",
        "|---|---:|---:|---:|",
        f"| MAD (`all_devs`, 28d) | {off_all:,} | {winget_only:,} | **{clean_mad:,}** |",
        f"| num_commits (28d) | {tot_c:,} | {wing_c:,} | **{tot_c - wing_c:,}** |",
        "",
        f"- winget touchers in window: **{winget_touch:,}** — {winget_only:,} winget-only "
        f"(drop), **{winget_touch - winget_only}** also touched a real repo (keep).",
        f"- winget = **{pct_mad:.1f}%** of MAD, **{pct_commits:.1f}%** of windowed commits.",
        "- Recent daily activity on repo 1770468 (devs / commits):",
    ]
    for day, d, c in daily:
        lines.append(f"  - {day}: {d} / {int(c)}")

    lines += ["", "## Contribution ranks"]
    if ranks:
        lines += [
            f"",
            f"VERIFIED against canonical `eco_developer_contribution_ranks` "
            f"(ecosystem_id={STELLAR_ECOSYSTEM_ID}, horizon day {H}, remote read).",
            "",
            "| rank | official | winget-only | **clean** |",
            "|---|---:|---:|---:|",
        ]
        for k, label in (("full_time", "full_time"), ("part_time", "part_time"), ("one_time", "one_time")):
            off, w, clean = ranks[k]
            pct = 100 * w / off if off else 0
            lines.append(f"| {label} | {off:,} | **{w} ({pct:.0f}%)** | **{clean:,}** |")
        lines.append("")
        lines.append("Official rank totals should match `eco_mads` (%d / %d / %d)." % (off_ft, off_pt, off_ot))
    else:
        lines += ["", "_(skipped canonical remote verification; rerun without --no-ranks)_"]

    lines += [
        "",
        "## Quote with caveats — NOT recomputable",
        "",
        "The exclusive/multichain split needs cross-ecosystem data (not in the Stellar-only "
        "extract; winget devs propagate into other-eco rollups). Tenure is by first-ever commit.",
        "",
        f"| metric | official {H} | note |",
        "|---|---:|---|",
        f"| exclusive_devs | {exclusive:,} | can't split winget out — needs cross-eco data |",
        f"| multichain_devs | {multichain:,} | winget-only devs propagate into other-eco rollups → likely inflated |",
        f"| devs_0_1y / 1_2y / 2y+ | {d01:,} / {d12:,} / {d2p:,} | winget upstream devs are new-to-Stellar → concentrated in 0_1y |",
        "",
        f"**Headline: clean MAD ≈ {clean_mad:,} vs official {off_all:,}.**",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
