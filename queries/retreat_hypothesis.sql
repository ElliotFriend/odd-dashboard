-- retreat_hypothesis.sql
-- Investigates whether the SDF all-staff retreat (May 18-22, 2026) pulled core
-- engineers off github.com/stellar/* repos enough to compound the May MAD drop.
--
-- Run:  duckdb stellar_extract.duckdb < queries/retreat_hypothesis.sql
--   (or via the Python client: duckdb.connect('stellar_extract.duckdb', read_only=True))
--
-- FINDING (against the 2026-06-03 extract): the lull is real but it's a VOLUME
-- story, not a HEAD-COUNT story, so it does NOT meaningfully compound the MAD drop.
--   * Q2: stellar/* weekday activity ~halved during the retreat (30.4 -> 15.4 devs/day;
--         182 -> 59 commits/day).
--   * Q3: yet only 4 of 85 stellar/* window-devs had their ENTIRE 28-day footprint
--         inside the retreat week -- an upper bound (the week wasn't a total blackout),
--         vs a ~600-dev MAD drop. A 5-day gap can't evict a regular committer from a
--         28-day window. The Drips Wave 4 (Apr 22-29) roll-off remains the head-count cause.
--
-- Notes:
--   * The repo URL column is `link`; `repos.name` holds owner/repo, so
--     `name ILIKE 'stellar/%'` is an equivalent, shorter filter.
--   * repo_day counts a dev on EVERY repo they touch -- don't SUM per-repo devs as a partition.

-- Q1 · daily activity on stellar/* repos around the retreat
WITH s AS (SELECT id FROM repos WHERE link ILIKE 'https://github.com/stellar/%')
SELECT rd.day, dayname(rd.day) AS dow,
       COUNT(DISTINCT rd.dev) AS devs, SUM(rd.num_commits) AS commits
FROM repo_day rd JOIN s ON s.id = rd.repo_id
WHERE rd.day BETWEEN DATE '2026-05-11' AND DATE '2026-05-29'
GROUP BY 1, 2 ORDER BY 1;

-- Q2 · retreat week vs. prior-weeks weekday baseline (the dip)
WITH s AS (SELECT id FROM repos WHERE link ILIKE 'https://github.com/stellar/%'),
daily AS (SELECT rd.day, COUNT(DISTINCT rd.dev) devs, SUM(rd.num_commits) commits
          FROM repo_day rd JOIN s ON s.id = rd.repo_id
          WHERE rd.day BETWEEN DATE '2026-04-20' AND DATE '2026-05-22' GROUP BY 1)
SELECT CASE WHEN day BETWEEN DATE '2026-05-18' AND DATE '2026-05-22'
            THEN 'retreat May18-22' ELSE 'baseline weekdays' END AS period,
       COUNT(*) n_days, ROUND(AVG(devs), 1) avg_devs, ROUND(AVG(commits), 1) avg_commits
FROM daily WHERE isodow(day) <= 5 GROUP BY 1 ORDER BY 1;

-- Q3 · KEY TEST: would the retreat evict anyone from the 28-day MAD window?
-- "would_drop" = stellar/* devs whose ONLY ecosystem activity in the window
-- (Apr 29-May 26) fell inside the retreat week. Upper bound; expect ~0.
WITH s AS (SELECT id FROM repos WHERE link ILIKE 'https://github.com/stellar/%'),
stellar_devs AS (SELECT DISTINCT rd.dev FROM repo_day rd JOIN s ON s.id = rd.repo_id
                 WHERE rd.day > DATE '2026-05-26' - 28 AND rd.day <= DATE '2026-05-26'),
win AS (SELECT dd.dev, dd.day, dd.num_commits FROM dev_day dd
        JOIN stellar_devs sd ON sd.dev = dd.dev
        WHERE dd.day > DATE '2026-05-26' - 28 AND dd.day <= DATE '2026-05-26'),
per_dev AS (SELECT dev,
   SUM(CASE WHEN day BETWEEN DATE '2026-05-18' AND DATE '2026-05-22' THEN num_commits ELSE 0 END) retreat_c,
   SUM(CASE WHEN day NOT BETWEEN DATE '2026-05-18' AND DATE '2026-05-22' THEN num_commits ELSE 0 END) other_c
   FROM win GROUP BY dev)
SELECT COUNT(*) stellar_devs_in_window,
       COUNT(*) FILTER (WHERE retreat_c > 0) active_during_retreat,
       COUNT(*) FILTER (WHERE retreat_c > 0 AND other_c = 0) would_drop_if_retreat_removed,
       COUNT(*) FILTER (WHERE other_c > 0) still_present_without_retreat
FROM per_dev;

-- Q4 · does the retreat show in ecosystem-wide daily activity?
SELECT day, dayname(day) AS dow, daily_active_devs, daily_commits
FROM daily_activity WHERE day BETWEEN DATE '2026-05-11' AND DATE '2026-05-29' ORDER BY day;
