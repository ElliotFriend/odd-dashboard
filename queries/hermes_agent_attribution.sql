-- hermes_agent_attribution.sql
-- How one repo's contributors end up in other ecosystems' MAD, traced through the
-- ODD tables. Built for NousResearch/hermes-agent (Oct 2026), but every query is
-- driven by the variables below, so it works for any repo / ecosystems / dates.
--
-- Run:  duckdb < queries/hermes_agent_attribution.sql
--   (reads the CURRENT snapshot straight from data.opendevdata.org; nothing is
--    downloaded except the column chunks each query needs. Whole file ~2-4 min.)
-- Interactive: `duckdb`, then `.read queries/hermes_agent_attribution.sql`, then
--   re-run single queries after changing a variable with SET VARIABLE.
--
-- FINDING (snapshot 20261001T130407):
--   * The upstream repo is listed in the taxonomy only under Nous Research and
--     AI (Category) (Q4), yet repo_developer_activities credits ALL of its activity
--     to zkSync, Arbitrum, etc., flagged is_explicit = true (Q3, Q8).
--   * ~17 copies of the repo (NOT GitHub forks) ARE listed under those chains (Q5).
--     The copies own zero commits and zero activity rows (Q5, Q6); every commit
--     sha is stored once, under the upstream id.
--   * So a copy listed under a chain behaves as if the upstream were listed there,
--     for its whole history including commits made after the copy went stale (Q7).
--     HOW ODD links the copy to the upstream (shared commit history?) is inferred,
--     not documented. There is no fork / parent column anywhere in ODD.
--
-- UPDATE (snapshot 20261005T130551, horizon 2026-09-27):
--   * The upstream itself is now listed DIRECTLY under all nine chains, every row
--     stamped 2026-09-28 20:08:14 (one automated batch) (Q4). A 17th copy,
--     willl376/hermes-agent-patched, was added the same day (Q5).
--   * MAD impact is about the same, since copies already credited the whole repo:
--     ~6.9-7.0k hermes-only devs per chain at 2026-09-23, ~6.5-6.6k at 2026-09-27
--     (Ethereum 13,905 -> ~7,400 without it) (Q8). Stellar: 0.
--   * Probable trigger (inferred): the repo ships optional-skills/blockchain/evm
--     ("8 chains: Ethereum, BNB, Base, Arbitrum, Polygon, Optimism, Avalanche,
--     zkSync", added upstream 2026-05-13) plus optional-skills/blockchain/solana
--     (2026-03-09). That is exactly the nine chains. Copies mapped 2026-05-19 got
--     only Base/Solana/Arbitrum (pre-EVM-skill); full nine-chain sets start July.
--     A hyperliquid skill also exists; Hyperliquid is not mapped (yet).
--   * None of the nine-chain mappings are in the public open-dev-data migrations
--     (only 3 copy repadds are), so they come from EC's internal auto-discovery /
--     classifier, not community PRs. The same exact nine-chain fingerprint sits on
--     61 mostly 0-star agent repos added Jul-Sep 2026 (vs ~1-9/month before), of
--     which 10 match copy_like and 24 contain 'hermes' in the name (Q9).
--
-- Table cheat sheet (there is no eco_repos / eco_committers):
--   repos                       id, name ('owner/repo'), link (URL), repo_created_at
--   ecosystems                  id, name
--   ecosystems_repos            the taxonomy as listed: (ecosystem_id, repo_id, created_at)
--   ecosystems_repos_recursive  same, plus inheritance through parent ecosystems
--   developer_activities        repo_id, day, canonical_developer_id, num_commits
--                               (per repo per dev per day; NO ecosystem)
--   repo_developer_activities   same + ecosystem_id + is_explicit etc.: what each
--                               ecosystem is actually credited with, per repo
--   eco_developer_activities    ecosystem_id, day, dev, repo_ids[], is_exclusive
--                               (the input to eco_mads)
--   eco_mads                    ecosystem_id, day, all_devs ... (28-day windows)
--   commits                     repo_id, sha1, authored_at, canonical_developer_id
--
-- Cost: the big activity files are sorted by ecosystem_id, so ALWAYS filter them
-- by ecosystem when you can (seconds). Filtering only by repo_id scans the file.

.maxrows 500
INSTALL httpfs; LOAD httpfs;
SET enable_progress_bar = false;

-- ── knobs ──────────────────────────────────────────────────────────────────────
SET VARIABLE repo      = 'NousResearch/hermes-agent';
SET VARIABLE copy_like = '%hermes-agent%';          -- name pattern for copies (Q5)
SET VARIABLE ecos      = ['Ethereum', 'Solana', 'Polygon', 'Arbitrum', 'Base', 'Optimism',
                          'Avalanche', 'BNB Chain', 'zkSync', 'Stellar'];
SET VARIABLE end_day     = DATE '2026-09-23';       -- the ONE date to change
SET VARIABLE window_days = 28;                      -- 28 lines up with eco_mads (Q8)
-- derived: inclusive range [start_day, end_day] of window_days days
SET VARIABLE start_day = getvariable('end_day') - (getvariable('window_days') - 1);

-- ── tables (snapshot version read from the manifest, never hardcoded) ──────────
SET VARIABLE snap = (SELECT 'https://data.opendevdata.org/snapshots/' || dataset.version || '/'
                     FROM read_json('https://data.opendevdata.org/manifest.json'));
.print '=== snapshot ==='
SELECT getvariable('snap') AS snapshot;

-- small tables: load once into memory
CREATE OR REPLACE TABLE ecosystems       AS FROM read_parquet(getvariable('snap') || 'ecosystems.parquet');
CREATE OR REPLACE TABLE repos            AS FROM read_parquet(getvariable('snap') || 'repos.parquet');
CREATE OR REPLACE TABLE ecosystems_repos AS FROM read_parquet(getvariable('snap') || 'ecosystems_repos.parquet');
-- big tables: remote views
CREATE OR REPLACE VIEW ecosystems_repos_recursive AS FROM read_parquet(getvariable('snap') || 'ecosystems_repos_recursive.parquet');
CREATE OR REPLACE VIEW developer_activities       AS FROM read_parquet(getvariable('snap') || 'developer_activities.parquet');
CREATE OR REPLACE VIEW repo_developer_activities  AS FROM read_parquet(getvariable('snap') || 'repo_developer_activities.parquet');
CREATE OR REPLACE VIEW eco_developer_activities   AS FROM read_parquet(getvariable('snap') || 'eco_developer_activities.parquet');
CREATE OR REPLACE VIEW eco_mads                   AS FROM read_parquet(getvariable('snap') || 'eco_mads.parquet');
CREATE OR REPLACE VIEW commits                    AS FROM read_parquet(getvariable('snap') || 'commits.parquet');

SET VARIABLE repo_id = (SELECT id FROM repos WHERE name = getvariable('repo'));
SET VARIABLE eco_ids = (SELECT list(id) FROM ecosystems WHERE list_contains(getvariable('ecos'), name));


.print ''
.print '=== Q1 · repo id ==='
-- Q1 · the repo's id (repos.name is 'owner/repo'; repos.link is the full URL)
SELECT id, name, link, repo_created_at::DATE AS repo_created, num_stars, num_forks
FROM repos WHERE name = getvariable('repo');


.print ''
.print '=== Q2a · unique contributors to the repo (all-time / in range) ==='
-- Q2 · unique contributors to the repo: all-time, in [start_day, end_day], and by month
SELECT COUNT(DISTINCT canonical_developer_id) AS devs_all_time,
       COUNT(DISTINCT canonical_developer_id)
         FILTER (WHERE day BETWEEN getvariable('start_day') AND getvariable('end_day')) AS devs_in_range,
       SUM(num_commits) AS commits_all_time
FROM developer_activities WHERE repo_id = getvariable('repo_id');

.print ''
.print '=== Q2b · unique contributors to the repo, by month ==='
SELECT date_trunc('month', day)::DATE AS month,
       COUNT(DISTINCT canonical_developer_id) AS devs, SUM(num_commits) AS commits
FROM developer_activities WHERE repo_id = getvariable('repo_id')
GROUP BY 1 ORDER BY 1;


.print ''
.print '=== Q3 · contributors each ecosystem is credited with from the repo ==='
-- Q3 · unique contributors each ecosystem is CREDITED with from this repo
--      (all-time and in range). is_explicit = ODD considers the repo directly listed.
SELECT e.name AS ecosystem,
       COUNT(DISTINCT r.canonical_developer_id) AS devs_all_time,
       COUNT(DISTINCT r.canonical_developer_id)
         FILTER (WHERE r.day BETWEEN getvariable('start_day') AND getvariable('end_day')) AS devs_in_range,
       bool_or(r.is_explicit) AS is_explicit,
       MIN(r.day) AS first_credited_day, MAX(r.day) AS last_credited_day
FROM repo_developer_activities r JOIN ecosystems e ON e.id = r.ecosystem_id
WHERE list_contains(getvariable('eco_ids'), r.ecosystem_id)
  AND r.repo_id = getvariable('repo_id')
GROUP BY 1 ORDER BY devs_all_time DESC;


.print ''
.print '=== Q4 · where the repo is listed in the taxonomy ==='
-- Q4 · where the repo is actually LISTED in the taxonomy (compare with Q3:
--      a credited ecosystem that is missing here is credited through something else)
SELECT e.name AS ecosystem, 'direct' AS how, q.created_at::DATE AS added, NULL AS via_path
FROM ecosystems_repos q JOIN ecosystems e ON e.id = q.ecosystem_id
WHERE q.repo_id = getvariable('repo_id')
UNION ALL
SELECT e.name, 'recursive', q.created_at::DATE, q.path::VARCHAR
FROM ecosystems_repos_recursive q JOIN ecosystems e ON e.id = q.ecosystem_id
WHERE q.repo_id = getvariable('repo_id')
ORDER BY how, ecosystem;


.print ''
.print '=== Q5 · copies: where they are listed + their own activity ==='
-- Q5 · the copies: same-ish name, which of the chosen ecosystems list them, and
--      whether ODD holds ANY activity under their own ids (it doesn't)
WITH copies AS (
  SELECT id, name, repo_created_at::DATE AS repo_created FROM repos
  WHERE name ILIKE getvariable('copy_like') AND id <> getvariable('repo_id')
),
listed AS (
  SELECT q.repo_id, string_agg(e.name, ', ' ORDER BY e.name) AS listed_in, MIN(q.created_at)::DATE AS added
  FROM ecosystems_repos q JOIN ecosystems e ON e.id = q.ecosystem_id
  WHERE list_contains(getvariable('eco_ids'), q.ecosystem_id) GROUP BY 1
),
own_activity AS (
  SELECT repo_id, COUNT(*) AS activity_rows FROM developer_activities
  WHERE repo_id IN (SELECT id FROM copies) GROUP BY 1
)
SELECT c.name, c.repo_created, l.added, l.listed_in, COALESCE(a.activity_rows, 0) AS own_activity_rows
FROM copies c JOIN listed l ON l.repo_id = c.id LEFT JOIN own_activity a ON a.repo_id = c.id
ORDER BY l.added, c.name;


.print ''
.print '=== Q6 · commits stored per repo ==='
-- Q6 · commits stored per repo: each sha is stored once, all under the upstream
WITH ids AS (
  SELECT getvariable('repo_id') AS id
  UNION ALL
  SELECT DISTINCT q.repo_id FROM ecosystems_repos q JOIN repos r ON r.id = q.repo_id
  WHERE r.name ILIKE getvariable('copy_like') AND list_contains(getvariable('eco_ids'), q.ecosystem_id)
)
SELECT r.name, COUNT(c.sha1) AS commits_stored, COUNT(DISTINCT c.sha1) AS distinct_shas
FROM ids JOIN repos r ON r.id = ids.id
LEFT JOIN commits c ON c.repo_id = ids.id
GROUP BY 1 ORDER BY commits_stored DESC;


.print ''
.print '=== Q7 · whole-repo vs commit-by-commit credit, by month ==='
-- Q7 · KEY TEST: is the credit whole-repo or commit-by-commit? Compare the repo's
--      own dev-days with what each ecosystem is credited, month by month. 100% after
--      the copies went stale means whole-repo.
WITH own AS (
  SELECT date_trunc('month', day)::DATE AS month, COUNT(*) AS own_dev_days
  FROM developer_activities WHERE repo_id = getvariable('repo_id') GROUP BY 1
),
credited AS (
  SELECT e.name AS ecosystem, date_trunc('month', r.day)::DATE AS month, COUNT(*) AS credited_dev_days
  FROM repo_developer_activities r JOIN ecosystems e ON e.id = r.ecosystem_id
  WHERE list_contains(getvariable('eco_ids'), r.ecosystem_id) AND r.repo_id = getvariable('repo_id')
  GROUP BY 1, 2
)
SELECT c.ecosystem, o.month, o.own_dev_days, c.credited_dev_days,
       round(100.0 * c.credited_dev_days / o.own_dev_days, 1) AS pct_credited
FROM own o JOIN credited c USING (month)
WHERE o.month >= getvariable('start_day') - INTERVAL 12 MONTH
ORDER BY c.ecosystem, o.month;


.print ''
.print '=== Q8 · MAD impact in [start_day, end_day] ==='
-- Q8 · MAD impact in [start_day, end_day]: every dev in each ecosystem vs devs whose
--      ONLY activity there was this repo. With a 28-day range ending end_day,
--      all_devs_recount should equal eco_mads.all_devs exactly.
WITH w AS (
  SELECT ecosystem_id, canonical_developer_id AS dev,
         bool_and(repo_ids = [getvariable('repo_id')]) AS only_this_repo
  FROM eco_developer_activities
  WHERE list_contains(getvariable('eco_ids'), ecosystem_id)
    AND day BETWEEN getvariable('start_day') AND getvariable('end_day')
  GROUP BY 1, 2
)
SELECT e.name AS ecosystem,
       COUNT(*) AS all_devs_recount,
       COUNT(*) FILTER (WHERE only_this_repo) AS only_this_repo_devs,
       COUNT(*) FILTER (WHERE NOT only_this_repo) AS devs_without_it,
       m.all_devs AS eco_mads_all_devs_at_end_day
FROM w JOIN ecosystems e ON e.id = w.ecosystem_id
LEFT JOIN eco_mads m ON m.ecosystem_id = w.ecosystem_id AND m.day = getvariable('end_day')
GROUP BY e.name, m.all_devs ORDER BY only_this_repo_devs DESC;


.print ''
.print '=== Q9 · repos carrying the same chain fingerprint (all of the chosen chains) ==='
-- Q9 · repos listed under EVERY chain in `ecos` except Stellar (the fingerprint an
--      automated classifier leaves), by month first added, and how many are copies
--      of the repo by name. A spike here = the classifier tagging by chain mentions.
WITH chains AS (
  SELECT list(id) AS ids FROM ecosystems
  WHERE list_contains(getvariable('ecos'), name) AND name <> 'Stellar'
),
fp AS (
  SELECT q.repo_id, MIN(q.created_at)::DATE AS added
  FROM ecosystems_repos q, chains
  WHERE list_contains(chains.ids, q.ecosystem_id)
  GROUP BY 1
  HAVING COUNT(DISTINCT q.ecosystem_id) = (SELECT len(ids) FROM chains)
)
SELECT date_trunc('month', fp.added)::DATE AS month, COUNT(*) AS repos,
       COUNT(*) FILTER (WHERE r.name ILIKE getvariable('copy_like')) AS copy_named
FROM fp JOIN repos r ON r.id = fp.repo_id
GROUP BY 1 ORDER BY 1;
