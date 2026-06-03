#!/usr/bin/env python3
"""
stellar_odd.py - analyze Stellar developer activity from Electric Capital's
Open Dev Data (ODD) parquet dataset, without downloading the full ~47 GB.

Subcommands
  extract       Build a small `stellar_extract.duckdb` (Stellar rows only) that
                the dashboard reads. Reads remote parquet via DuckDB httpfs and
                writes only Stellar slices locally.
  diagnose      Explain movements in the 28-day MAD ("MAU") series: daily-vs-
                windowed overlay, surge auto-detection, cohort exit schedule, and
                repos that drove a period then went silent.
  snapshot-api  Append the live developerreport.com MAU series into the extract
                so you capture recent points BEFORE the public parquet catches up
                (the parquet trails ~7 days). Run weekly on a schedule.

Confirmed schema (June 2026 snapshot 20260602T130601), with runtime fallback:
  ecosystems(id, name, ...)
  eco_mads(ecosystem_id, day DATE, all_devs, exclusive_devs, multichain_devs,
           num_commits, devs_0_1y, devs_1_2y, devs_2y_plus,
           full_time_devs, part_time_devs, one_time_devs)        # 28-day windowed
  eco_developer_activities(ecosystem_id, day, canonical_developer_id, num_commits) # daily
  repo_developer_activities(ecosystem_id, day, repo_id, canonical_developer_id, num_commits)
  repos(id, repo_url, ...)
  Invariant: all_devs = exclusive_devs + multichain_devs

Attribution (CC BY 4.0): "Open Dev Data by Electric Capital",
https://github.com/electric-capital/open-dev-data , CC BY 4.0.
"""
from __future__ import annotations
import argparse, json, time, urllib.request
from urllib.parse import urljoin
import duckdb

MANIFEST_URL = "https://data.opendevdata.org/manifest.json"
DEVREPORT_MAU = "https://www.developerreport.com/api/charts/dev_mau/{eco}"
DEFAULT_OUT = "./stellar_extract.duckdb"


# --------------------------------------------------------------------------- manifest + connection
def http_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "stellar-odd/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def load_manifest() -> tuple[str, dict]:
    ds = http_json(MANIFEST_URL)["dataset"]
    version = ds["version"]
    table_url = {}
    for res in ds["resources"]:
        name = res["path"].rsplit("/", 1)[-1].replace(".parquet", "")
        table_url[name] = urljoin(MANIFEST_URL, res["path"])
    return version, table_url


def connect(db: str | None = None) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(db) if db else duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET enable_http_metadata_cache=true;")
    return con


# --------------------------------------------------------------------------- schema introspection
def columns(con, url: str) -> list[str]:
    return [r[0] for r in con.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{url}') LIMIT 0").fetchall()]


def columns_local(con, table: str) -> list[str]:
    return [r[1] for r in con.execute(f"PRAGMA table_info('{table}')").fetchall()]


def pick(cols: list[str], *candidates: str) -> str | None:
    low = {c.lower(): c for c in cols}
    for cand in candidates:
        if cand.lower() in low:
            return low[cand.lower()]
    for cand in candidates:
        for c in cols:
            if cand.lower() in c.lower():
                return c
    return None


def need(name: str, val: str | None, cols: list[str]) -> str:
    if val is None:
        raise SystemExit(f"Could not resolve {name!r} column. Available: {cols}")
    return val


def stellar_id(con, table_url, eco_name="Stellar"):
    url = table_url["ecosystems"]; cols = columns(con, url)
    name_col = need("ecosystem name", pick(cols, "name", "eco_name", "ecosystem_name"), cols)
    id_col = need("ecosystem id", pick(cols, "id", "ecosystem_id", "eco_id"), cols)
    rows = con.execute(
        f'SELECT "{id_col}" FROM read_parquet(\'{url}\') WHERE "{name_col}" = ?',
        [eco_name]).fetchall()
    if not rows:
        near = con.execute(
            f'SELECT "{name_col}" FROM read_parquet(\'{url}\') WHERE "{name_col}" ILIKE ? LIMIT 20',
            [f"%{eco_name}%"]).fetchall()
        raise SystemExit(f"{eco_name!r} not found. Similar: {[n[0] for n in near]}")
    return rows[0][0]


# --------------------------------------------------------------------------- extract
def cmd_extract(args):
    version, table_url = load_manifest()
    print(f"snapshot version: {version}")
    con = connect()
    sid = stellar_id(con, table_url, args.ecosystem)
    print(f"{args.ecosystem} ecosystem id = {sid!r}")

    con.execute(f"ATTACH '{args.out}' AS ex;")

    url = table_url["eco_mads"]; c = columns(con, url)
    eco = need("eco_mads.ecosystem_id", pick(c, "ecosystem_id", "eco_id"), c)
    con.execute(f'CREATE OR REPLACE TABLE ex.eco_mads AS '
                f'SELECT * FROM read_parquet(\'{url}\') WHERE "{eco}" = ?', [sid])
    print(f"  eco_mads rows (Stellar): {con.execute('SELECT COUNT(*) FROM ex.eco_mads').fetchone()[0]:,}")

    url = table_url["eco_developer_activities"]; c = columns(con, url)
    eco = need("eco_dev.ecosystem_id", pick(c, "ecosystem_id", "eco_id"), c)
    day = need("eco_dev.day", pick(c, "day", "date", "snapshot_date"), c)
    dev = need("eco_dev.developer_id", pick(c, "canonical_developer_id", "developer_id", "dev_id"), c)
    com = need("eco_dev.num_commits", pick(c, "num_commits", "commits", "commit_count"), c)
    con.execute(f'''CREATE OR REPLACE TABLE ex.daily_activity AS
        SELECT "{day}" AS day, COUNT(DISTINCT "{dev}") AS daily_active_devs,
               SUM("{com}") AS daily_commits
        FROM read_parquet('{url}') WHERE "{eco}" = ? GROUP BY 1 ORDER BY 1''', [sid])
    con.execute(f'''CREATE OR REPLACE TABLE ex.dev_day AS
        SELECT "{dev}" AS dev, "{day}" AS day, "{com}" AS num_commits
        FROM read_parquet('{url}') WHERE "{eco}" = ?''', [sid])
    horizon = con.execute("SELECT MAX(day) FROM ex.daily_activity").fetchone()[0]
    print(f"  daily_activity through: {horizon}")

    url = table_url["repo_developer_activities"]; c = columns(con, url)
    eco = need("repo_dev.ecosystem_id", pick(c, "ecosystem_id", "eco_id"), c)
    day = need("repo_dev.day", pick(c, "day", "date"), c)
    rid = need("repo_dev.repo_id", pick(c, "repo_id", "repo"), c)
    dev = need("repo_dev.developer_id", pick(c, "canonical_developer_id", "developer_id"), c)
    com = need("repo_dev.num_commits", pick(c, "num_commits", "commits"), c)
    con.execute(f'''CREATE OR REPLACE TABLE ex.repo_day AS
        SELECT "{rid}" AS repo_id, "{day}" AS day, "{dev}" AS dev, "{com}" AS num_commits
        FROM read_parquet('{url}') WHERE "{eco}" = ?''', [sid])
    print(f"  repo_day rows: {con.execute('SELECT COUNT(*) FROM ex.repo_day').fetchone()[0]:,}")

    url = table_url["repos"]; c = columns(con, url)
    rid = need("repos.id", pick(c, "id", "repo_id"), c)
    con.execute(f'''CREATE OR REPLACE TABLE ex.repos AS
        SELECT r.* FROM read_parquet('{url}') r
        SEMI JOIN (SELECT DISTINCT repo_id FROM ex.repo_day) s ON r."{rid}" = s.repo_id''')
    print(f"  repos: {con.execute('SELECT COUNT(*) FROM ex.repos').fetchone()[0]:,}")

    con.execute("CREATE OR REPLACE TABLE ex.meta AS SELECT ? AS snapshot_version, "
                "?::DATE AS parquet_horizon, now() AS extracted_at, ? AS ecosystem, ? AS ecosystem_id",
                [version, str(horizon), args.ecosystem, str(sid)])
    con.execute("DETACH ex;")
    print(f"\nWrote {args.out}. Point the dashboard at it.")
    print("Source: Open Dev Data by Electric Capital, CC BY 4.0")


# --------------------------------------------------------------------------- diagnose
def cmd_diagnose(args):
    use_local = False
    try:
        con = connect(args.db)
        con.execute("SELECT 1 FROM daily_activity LIMIT 1")
        use_local = True
    except Exception:
        con = connect()

    if use_local:
        daily, devday, repoday, repos = "daily_activity", "dev_day", "repo_day", "repos"
        rc = columns_local(con, "repos")
        repos_id = pick(rc, "id", "repo_id"); repos_url = pick(rc, "repo_url", "url", "name")
        print(f"(reading local extract {args.db})")
    else:
        version, table_url = load_manifest()
        sid = stellar_id(con, table_url, args.ecosystem)
        print(f"(reading remote snapshot {version}; Stellar id={sid})")
        u = table_url["eco_developer_activities"]; c = columns(con, u)
        eco = pick(c, "ecosystem_id"); day = pick(c, "day", "date")
        dev = pick(c, "canonical_developer_id", "developer_id"); com = pick(c, "num_commits", "commits")
        con.execute(f'''CREATE TEMP VIEW dev_day AS SELECT "{dev}" dev, "{day}" day, "{com}" num_commits
            FROM read_parquet('{u}') WHERE "{eco}" = '{sid}' ''')
        con.execute("""CREATE TEMP VIEW daily_activity AS SELECT day,
            COUNT(DISTINCT dev) daily_active_devs, SUM(num_commits) daily_commits
            FROM dev_day GROUP BY 1""")
        u = table_url["repo_developer_activities"]; c = columns(con, u)
        eco = pick(c, "ecosystem_id"); day = pick(c, "day", "date"); rid = pick(c, "repo_id")
        dev = pick(c, "canonical_developer_id", "developer_id"); com = pick(c, "num_commits", "commits")
        con.execute(f'''CREATE TEMP VIEW repo_day AS SELECT "{rid}" repo_id, "{day}" day,
            "{dev}" dev, "{com}" num_commits FROM read_parquet('{u}') WHERE "{eco}" = '{sid}' ''')
        daily, devday, repoday = "daily_activity", "dev_day", "repo_day"
        repos = f"read_parquet('{table_url['repos']}')"
        rc = columns(con, table_url["repos"])
        repos_id = pick(rc, "id", "repo_id"); repos_url = pick(rc, "repo_url", "url", "name")

    W = args.window
    horizon = con.execute(f"SELECT MAX(day) FROM {daily}").fetchone()[0]
    as_of = args.as_of or str(horizon)
    print(f"\nWindow = {W}d | parquet horizon = {horizon} | as_of = {as_of}\n")

    print("Daily activity (un-windowed), last 21 days to horizon:")
    for r in con.execute(f"""SELECT day, daily_active_devs, daily_commits FROM {daily}
        WHERE day > (SELECT MAX(day) FROM {daily}) - 21 ORDER BY day DESC""").fetchall():
        print(f"  {r[0]}  devs={r[1]:>4}  commits={r[2]:>6}")

    print("\nDetected activity surges (daily devs > 2x trailing-90d median):")
    surges = con.execute(f"""WITH d AS (SELECT day, daily_active_devs,
            median(daily_active_devs) OVER (ORDER BY day
                RANGE BETWEEN 90 PRECEDING AND 1 PRECEDING) AS base FROM {daily})
        SELECT day, daily_active_devs, base FROM d
        WHERE base IS NOT NULL AND daily_active_devs > 2*base ORDER BY day""").fetchall()
    for r in (surges or []):
        print(f"  {r[0]}  devs={r[1]:>4}  (baseline~{r[2]:.0f})")
    if not surges:
        print("  none")

    print(f"\nCohort exit schedule - devs in the {W}d window ending {as_of}, by last-active week:")
    rows = con.execute(f"""WITH acts AS (SELECT dev, day FROM {devday}
            WHERE day > DATE '{as_of}' - {W} AND day <= DATE '{as_of}'),
          last_seen AS (SELECT dev, MAX(day) AS last_active_day FROM acts GROUP BY dev)
        SELECT date_trunc('week', last_active_day) AS wk, COUNT(*) AS devs
        FROM last_seen GROUP BY 1 ORDER BY 1""").fetchall()
    total = sum(r[1] for r in rows) or 1
    for r in rows:
        bar = "#" * int(40 * r[1] / total)
        print(f"  week of {str(r[0])[:10]}  {r[1]:>5}  {bar}")
    print(f"  total in window = {total}")

    if args.surge_from and args.surge_to:
        print(f"\nRepos active {args.surge_from}..{args.surge_to} but silent after (drivers that aged out):")
        q = f"""WITH s AS (SELECT repo_id, COUNT(DISTINCT dev) devs, SUM(num_commits) commits,
                    MAX(day) last_active_day FROM {repoday}
                 WHERE day BETWEEN DATE '{args.surge_from}' AND DATE '{args.surge_to}' GROUP BY repo_id),
             still AS (SELECT DISTINCT repo_id FROM {repoday} WHERE day > DATE '{args.surge_to}')
        SELECT rp."{repos_url}" AS repo, s.devs, s.commits, s.last_active_day
        FROM s LEFT JOIN {repos} rp ON rp."{repos_id}" = s.repo_id
        WHERE s.repo_id NOT IN (SELECT repo_id FROM still)
        ORDER BY s.devs DESC LIMIT {args.limit}"""
        for r in con.execute(q).fetchall():
            print(f"  {str(r[1]):>4} devs  {str(r[2]):>6} commits  last={r[3]}  {r[0]}")

    try:
        print("\nLive developerreport.com (newest 6 weekly points):")
        for d, v in devreport_series(args.ecosystem.lower())[:6]:
            print(f"  {d}  {v}")
    except Exception as e:
        print(f"(API cross-check failed: {e})")


# --------------------------------------------------------------------------- snapshot-api
def devreport_series(eco="stellar") -> list[tuple]:
    data = http_json(DEVREPORT_MAU.format(eco=eco))
    series = {s["name"]: s["data"] for s in data["series"]}
    by_ts = {}
    for name, pts in series.items():
        for ts, val in pts:
            by_ts.setdefault(ts, {})[name] = val
    out = []
    for ts in sorted(by_ts, reverse=True):
        out.append((time.strftime("%Y-%m-%d", time.gmtime(ts/1000)),
                    by_ts[ts].get("Total monthly active developers")))
    return out


def cmd_snapshot_api(args):
    data = http_json(DEVREPORT_MAU.format(eco=args.ecosystem.lower()))
    series = {s["name"]: s["data"] for s in data["series"]}
    by_ts = {}
    for name, pts in series.items():
        for ts, val in pts:
            by_ts.setdefault(ts, {})[name] = val
    con = connect(args.db)
    con.execute("""CREATE TABLE IF NOT EXISTS mau_api_history(
        captured_at TIMESTAMP, ecosystem VARCHAR, day DATE, total INTEGER,
        single_chain INTEGER, multi_chain INTEGER, PRIMARY KEY (ecosystem, day))""")
    n = 0
    for ts, row in by_ts.items():
        d = time.strftime("%Y-%m-%d", time.gmtime(ts/1000))
        con.execute("""INSERT INTO mau_api_history VALUES (now(), ?, ?, ?, ?, ?)
            ON CONFLICT (ecosystem, day) DO UPDATE SET total=excluded.total,
              single_chain=excluded.single_chain, multi_chain=excluded.multi_chain,
              captured_at=excluded.captured_at""",
            [args.ecosystem, d, row.get("Total monthly active developers"),
             row.get("Single-chain developers"), row.get("Multi-chain developers")])
        n += 1
    con.close()
    print(f"Upserted {n} API points into {args.db} (table mau_api_history).")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ecosystem", default="Stellar")
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("extract"); e.add_argument("--out", default=DEFAULT_OUT); e.set_defaults(func=cmd_extract)
    d = sub.add_parser("diagnose")
    d.add_argument("--db", default=DEFAULT_OUT); d.add_argument("--window", type=int, default=28)
    d.add_argument("--as-of", default=None); d.add_argument("--surge-from", default=None)
    d.add_argument("--surge-to", default=None); d.add_argument("--limit", type=int, default=25)
    d.set_defaults(func=cmd_diagnose)
    s = sub.add_parser("snapshot-api"); s.add_argument("--db", default=DEFAULT_OUT); s.set_defaults(func=cmd_snapshot_api)
    args = ap.parse_args(); args.func(args)


if __name__ == "__main__":
    main()
