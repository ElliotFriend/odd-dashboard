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

// ---- /api/mau ----

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

/** Fresher MAU points captured from developerreport.com by `snapshot-api`. */
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

export interface MauResponse {
  windowed: WindowedRow[];
  daily: DailyRow[];
  api: ApiRow[];
  meta: Meta;
}

// ---- /api/repos ----

/** A repo leaderboard row over a trailing window. */
export interface RepoRow {
  repo: string; // owner/repo (display)
  url: string;  // full GitHub URL (href)
  devs: number;
  commits: number;
  last_active_day: string;
}

export interface ReposResponse {
  rows: RepoRow[];
  days: number;
  order: 'devs' | 'commits';
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

// ---- /api/events ----

/** A curated timeline event (bounty program, hackathon, …) to annotate the chart.
 *  Source of truth is the version-controlled events.json at the repo root. */
export interface TimelineEvent {
  title: string;
  partner: string;
  start: string; // yyyy-mm-dd (inclusive)
  end: string;   // yyyy-mm-dd (inclusive)
  description?: string;
  url?: string;
}

export interface EventsResponse {
  events: TimelineEvent[];
}
