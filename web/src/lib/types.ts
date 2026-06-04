// Shared data shapes for the dashboard: chart series + the /api/* payloads.
// The DB layer (db.ts) normalizes BigInt -> number and Date -> 'yyyy-mm-dd',
// so every numeric column below arrives as a JS number and every day as a string.

/** A single point on a time series: ISO yyyy-mm-dd day + numeric value. */
export interface ChartPoint {
    day: string;
    value: number;
}

/** A line series for Chart.svelte. */
export interface ChartLine {
    name: string;
    color: string;
    data: ChartPoint[];
    /** SVG stroke-dasharray, e.g. '4 3' for a dashed line. */
    dash?: string;
}

/** A bar series for Chart.svelte (drawn faintly behind the lines). */
export interface ChartBars {
    name: string;
    color: string;
    data: ChartPoint[];
}

// ---- /api/mad ----

/** 28-day windowed metrics from eco_mads. */
export interface WindowedRow {
    day: string;
    all_devs: number;
    exclusive_devs: number;
    multichain_devs: number;
    num_commits: number;
}

/** Daily (un-windowed) activity from daily_activity. */
export interface DailyRow {
    day: string;
    daily_active_devs: number;
    daily_commits: number;
}

/** Fresher MAD points captured from developerreport.com by `snapshot-api`
 *  (their live series labels this "MAU" — same number: ≥1 commit in the 28-day window). */
export interface ApiRow {
    day: string;
    total: number | null;
    single_chain: number | null;
    multi_chain: number | null;
}

/** Extract provenance (the `meta` table). */
export interface Meta {
    snapshot_version?: string;
    parquet_horizon?: string;
    extracted_at?: string;
    ecosystem?: string;
    ecosystem_id?: string;
}

export interface MadResponse {
    windowed: WindowedRow[];
    daily: DailyRow[];
    api: ApiRow[];
    meta: Meta;
}

// ---- /api/repos ----

/** A repo leaderboard row over a trailing window. */
export interface RepoRow {
    repo: string; // owner/repo (display)
    url: string; // full GitHub URL (href)
    devs: number;
    commits: number;
    last_active_day: string;
}

export interface ReposResponse {
    rows: RepoRow[];
    days: number;
    order: 'devs' | 'commits';
}

/** Per-developer commits / active-days / repos-touched across the 28/60/90-day windows,
 *  with GitHub identity (from the `developers` table). The leaderboard picks a window +
 *  sort client-side. `login` is null when it couldn't be resolved. */
export interface DevAgg {
    dev: number;
    name: string | null;
    login: string | null;
    c28: number;
    a28: number;
    r28: number;
    c60: number;
    a60: number;
    r60: number;
    c90: number;
    a90: number;
    r90: number;
}

/** Per-repo devs+commits across the 28/60/90-day windows (loaded once; the leaderboard
 *  picks a window + sort client-side). */
export interface RepoAgg {
    repo: string; // owner/repo (display)
    url: string; // full GitHub URL (href)
    last_active_day: string;
    d28: number;
    c28: number;
    d60: number;
    c60: number;
    d90: number;
    c90: number;
}

// ---- /api/diagnose ----

/** Rolling cohort split (recurring vs new) per anchor day. */
export interface CohortRow {
    day: string;
    total: number;
    recurring: number;
    new_devs: number;
}

/** Contributor intensity for the current window. May be empty if no rows. */
export interface Intensity {
    commits?: number | null;
    devs?: number | null;
    commits_per_dev?: number | null;
}

/** A detected daily surge day (daily devs > 2x trailing-90d median). */
export interface SurgeDay {
    day: string;
    devs: number;
    base: number;
}

export interface DiagnoseResponse {
    cohort: CohortRow[];
    intensity: Intensity;
    surgeDays: SurgeDay[];
    window: number;
}

// ---- drill-down detail pages (/dev/[login], /repo/[...slug]) ----

/** Per-window (28/60/90d) + all-time commits & active-days. The detail pages pick a
 *  window client-side; a row with 0 commits in the chosen window is filtered out. */
export interface WindowMetrics {
    c28: number;
    a28: number;
    c60: number;
    a60: number;
    c90: number;
    a90: number;
    c_all: number;
    a_all: number;
    last_active: string;
}

/** One repo a developer has committed to. */
export interface DevRepoRow extends WindowMetrics {
    repo: string;
    url: string;
}
export interface DevDetail {
    login: string;
    name: string | null;
    repos: DevRepoRow[];
}

/** One developer who has committed to a repo. */
export interface RepoDevRow extends WindowMetrics {
    dev: number;
    name: string | null;
    login: string | null;
}
export interface RepoDetail {
    repo: string;
    url: string;
    devs: RepoDevRow[];
}

// ---- day drill-down (/day/[date]) ----

/** One (repo, developer) pair active on a given day, with names/identity + commit count.
 *  `login`/`name` are null when the dev's identity couldn't be resolved; `is_bot` is false
 *  when the `developers` table is absent. The page groups these by repo and by dev. */
export interface DayPair {
    repo_id: number;
    repo: string; // owner/repo (display)
    url: string; // full GitHub URL (href)
    dev: number; // canonical_developer_id
    name: string | null;
    login: string | null;
    is_bot: boolean;
    commits: number;
}

export interface DayDetail {
    date: string;
    /** Every (repo, dev) pair active that day — ≤~1.2k rows; groupings derive client-side. */
    pairs: DayPair[];
    /** Of devs active that day: how many also committed in the prior 28d (returning) vs not (fresh). */
    cohort: { total: number; returning: number; fresh: number };
    /** Nearest active day before/after (null at the ends); + the full data range for the picker. */
    prev: string | null;
    next: string | null;
    earliest: string;
    latest: string;
}

// ---- /api/events ----

/** A curated timeline event (bounty program, hackathon, …) to annotate the chart.
 *  Source of truth is the version-controlled events.json at the repo root. */
export interface TimelineEvent {
    title: string;
    partner: string;
    start: string; // yyyy-mm-dd (inclusive)
    end: string; // yyyy-mm-dd (inclusive)
    description?: string;
    url?: string;
}

export interface EventsResponse {
    events: TimelineEvent[];
}
