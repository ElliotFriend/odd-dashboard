<script lang="ts">
  import Chart from '$lib/Chart.svelte';
  import type {
    MauResponse, ReposResponse, DiagnoseResponse,
    ChartLine, ChartBars, TimelineEvent, EventsResponse
  } from '$lib/types';
  import { partnerColor } from '$lib/colors';

  let days = $state<number>(120);
  let repoWindow = $state<number>(28);
  let repoBy = $state<'devs' | 'commits'>('devs');
  let mau = $state<MauResponse | null>(null);
  let repos = $state<ReposResponse | null>(null);
  let diag = $state<DiagnoseResponse | null>(null);
  let events = $state<TimelineEvent[]>([]);

  async function loadMau() { mau = await (await fetch(`/api/mau?days=${days}`)).json() as MauResponse; }
  async function loadRepos() { repos = await (await fetch(`/api/repos?days=${repoWindow}&by=${repoBy}`)).json() as ReposResponse; }
  async function loadDiag() { diag = await (await fetch(`/api/diagnose?days=${days}`)).json() as DiagnoseResponse; }
  async function loadEvents() { events = ((await (await fetch('/api/events')).json()) as EventsResponse).events; }
  $effect(() => { loadMau(); });
  $effect(() => { loadRepos(); });
  $effect(() => { loadDiag(); });
  $effect(() => { loadEvents(); });

  const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString());
  const latest = <T, K extends keyof T>(arr: T[] | undefined | null, key: K): T[K] | null =>
    (arr && arr.length ? arr[arr.length - 1][key] : null);

  // current cohort decomposition (latest day of the rolling split)
  const cohortNow = $derived(diag?.cohort?.length ? diag.cohort[diag.cohort.length - 1] : null);
  // fallback 0 (never rendered: every use sits inside {#if cohortNow}) keeps the type non-null
  const recurringPct = $derived(cohortNow ? Math.round(100 * cohortNow.recurring / cohortNow.total) : 0);

  // cluster contiguous surge days (gap > 2 days starts a new run); report the largest recent run
  const surgeRuns = $derived.by(() => {
    const d = diag?.surgeDays ?? [];
    const runs: { start: string; end: string; endNum: number; peak: number }[] = [];
    for (const row of d) {
      const last = runs[runs.length - 1];
      const dayNum = Date.parse(row.day) / 86400000;
      if (last && dayNum - last.endNum <= 2) { last.end = row.day; last.endNum = dayNum; last.peak = Math.max(last.peak, row.devs); }
      else runs.push({ start: row.day, end: row.day, endNum: dayNum, peak: row.devs });
    }
    return runs.filter((r) => r.start !== r.end);   // drop lone-day blips
  });
  const lastSurge = $derived(surgeRuns.length ? surgeRuns[surgeRuns.length - 1] : null);

  // intensity read in plain language
  const intensityRead = $derived.by(() => {
    const cpd = diag?.intensity?.commits_per_dev;
    if (cpd == null) return null;
    if (cpd < 8) return { tag: 'drive-by / program-driven', tone: 'rose' };
    if (cpd < 20) return { tag: 'mixed', tone: 'amber' };
    return { tag: 'sustained building', tone: 'cyan' };
  });

  // Build chart series from the windowed + daily payloads.
  const lines = $derived<ChartLine[]>(mau ? [
    { name: 'MAD (28d)', color: 'var(--amber)', data: mau.windowed.map((d) => ({ day: d.day, value: d.all_devs })) },
    { name: 'single-chain', color: 'var(--cyan)', data: mau.windowed.map((d) => ({ day: d.day, value: d.exclusive_devs })) },
    { name: 'multi-chain', color: 'var(--rose)', data: mau.windowed.map((d) => ({ day: d.day, value: d.multichain_devs })) },
    ...(mau.api?.length ? [{ name: 'API total', color: 'var(--amber-soft)', dash: '4 3',
        data: mau.api.map((d) => ({ day: d.day, value: d.total as number })) }] : []),
    ...(diag?.cohort?.length ? [{ name: 'recurring base', color: '#7d8aa8', dash: '2 3',
        data: diag.cohort.map((d) => ({ day: d.day, value: d.recurring })) }] : [])
  ] : []);
  const bars = $derived<ChartBars | null>(mau ? { name: 'daily active', color: 'var(--amber)',
    data: mau.daily.map((d) => ({ day: d.day, value: d.daily_active_devs })) } : null);

  // recurring-base estimate: median daily-active over the window (de-surged signal)
  const recurringBase = $derived.by(() => {
    if (!mau?.daily?.length) return null;
    const v = mau.daily.map((d) => d.daily_active_devs).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
</script>

<div class="wrap">
  <header>
    <div class="brand">✦ <span>STELLAR</span> · developer activity</div>
    <div class="sub mono-label">
      {#if mau?.meta}snapshot {mau.meta.snapshot_version} · parquet through {mau.meta.parquet_horizon}{/if}
      · source: Open Dev Data by Electric Capital (CC BY 4.0)
    </div>
  </header>

  <section class="cards">
    <div class="panel card">
      <div class="mono-label">monthly active devs (28d)</div>
      <div class="big tnum">{fmt(latest(mau?.windowed, 'all_devs'))}</div>
      <div class="split">
        <span style="color:var(--cyan)">◆ {fmt(latest(mau?.windowed, 'exclusive_devs'))} single</span>
        <span style="color:var(--rose)">◆ {fmt(latest(mau?.windowed, 'multichain_devs'))} multi</span>
      </div>
    </div>
    <div class="panel card">
      <div class="mono-label">commits in window (28d)</div>
      <div class="big tnum">{fmt(latest(mau?.windowed, 'num_commits'))}</div>
    </div>
    <div class="panel card">
      <div class="mono-label">daily active (latest day)</div>
      <div class="big tnum">{fmt(latest(mau?.daily, 'daily_active_devs'))}</div>
      <div class="split">recurring base ≈ {fmt(recurringBase)}/day</div>
    </div>
    <div class="panel card">
      <div class="mono-label">api total (freshest)</div>
      <div class="big tnum">{fmt(latest(mau?.api, 'total'))}</div>
      <div class="split">{mau?.api?.length ? `as of ${latest(mau.api, 'day')}` : 'run snapshot-api'}</div>
    </div>
  </section>

  <section class="panel diag">
    <div class="chart-head"><h2>What moved the metric</h2>
      <span class="mono-label">28d window · cohort &amp; intensity</span></div>
    <div class="diag-grid">
      <div class="diag-box">
        <div class="mono-label">recurring vs. new (this window)</div>
        {#if cohortNow}
          <div class="stack">
            <div class="seg rec" style={`width:${recurringPct}%`}></div>
            <div class="seg new" style={`width:${100 - recurringPct}%`}></div>
          </div>
          <div class="legend">
            <span><b class="tnum">{fmt(cohortNow.recurring)}</b> recurring ({recurringPct}%)</span>
            <span><b class="tnum">{fmt(cohortNow.new_devs)}</b> new ({100 - recurringPct}%)</span>
          </div>
          <p class="hint">Recurring = also active in the prior 28-day window. A spike in <em>new</em> that later
            vanishes is a program/event wave, not base growth.</p>
        {:else}<div class="loading">…</div>{/if}
      </div>

      <div class="diag-box">
        <div class="mono-label">contributor intensity</div>
        <div class="big tnum">{fmt(diag?.intensity?.commits_per_dev)}<span class="unit">commits/dev</span></div>
        {#if intensityRead}
          <span class="pill" style={`color:var(--${intensityRead.tone});border-color:var(--${intensityRead.tone})`}>{intensityRead.tag}</span>
          <p class="hint">Low commits-per-dev across many contributors is the signature of drive-by / bounty-program
            activity — e.g. monthly bounty sprints like <a href="https://www.drips.network/wave/stellar" target="_blank" rel="noreferrer">Drips Wave</a> — rather than sustained team building.</p>
        {/if}
      </div>

      <div class="diag-box">
        <div class="mono-label">surge watch</div>
        {#if lastSurge}
          <div class="big small">{lastSurge.start.slice(5)} → {lastSurge.end.slice(5)}</div>
          <div class="hint">Peak ≈ <b class="tnum">{fmt(lastSurge.peak)}</b> daily devs. Activity surges roll off the
            28-day window ~28 days later — so a surge here mechanically deflates MAU about four weeks on, even with
            no change in the recurring base.</div>
        {:else}<div class="hint">No multi-day surge detected in range.</div>{/if}
      </div>
    </div>
  </section>

  <section class="panel chartwrap">
    <div class="chart-head">
      <h2>MAU vs. daily activity</h2>
      <div class="toggle">
        {#each [60, 90, 120, 365, 100000] as d}
          <button class:active={days === d} onclick={() => (days = d)}>{d >= 100000 ? 'all' : d + 'd'}</button>
        {/each}
      </div>
    </div>
    <p class="note">The bold line is the 28-day rolling MAD (what Developer Report plots). Faint bars are <em>daily</em> active devs.
      When the windowed line falls while the daily bars hold steady, you're seeing a past surge roll off the back of the window — not an exodus.</p>
    {#if events.length}
      <div class="evlegend">
        <span class="mono-label">programs</span>
        {#each [...new Set(events.map((e) => e.partner))] as p}
          <span class="evkey"><i style={`background:${partnerColor(p)}`}></i>{p}</span>
        {/each}
      </div>
    {/if}
    {#if mau}
      <Chart {lines} {bars} {events} horizon={mau.meta?.parquet_horizon} />
    {:else}<div class="loading">loading…</div>{/if}
  </section>

  <section class="panel chartwrap">
    <div class="chart-head">
      <h2>Repo leaderboard</h2>
      <div class="toggle">
        {#each [28, 60, 90] as d}<button class:active={repoWindow === d} onclick={() => (repoWindow = d)}>{d}d</button>{/each}
        <span class="div"></span>
        <button class:active={repoBy === 'devs'} onclick={() => (repoBy = 'devs')}>by devs</button>
        <button class:active={repoBy === 'commits'} onclick={() => (repoBy = 'commits')}>by commits</button>
      </div>
    </div>
    {#if repos}
      <table>
        <thead><tr><th>#</th><th>repo</th><th class="r">devs</th><th class="r">commits</th><th class="r">last active</th></tr></thead>
        <tbody>
          {#each repos.rows as r, i}
            <tr><td class="faint">{i + 1}</td>
              <td>{#if String(r.repo).startsWith('http')}<a href={r.repo} target="_blank" rel="noreferrer">{r.repo.replace('https://github.com/', '')}</a>{:else}{r.repo}{/if}</td>
              <td class="r tnum">{fmt(r.devs)}</td><td class="r tnum">{fmt(r.commits)}</td>
              <td class="r faint">{r.last_active_day}</td></tr>
          {/each}
        </tbody>
      </table>
    {:else}<div class="loading">loading…</div>{/if}
  </section>

  <footer class="mono-label">stellar_extract.duckdb · rebuild with <code>python stellar_odd.py extract</code></footer>
</div>

<style>
  .wrap{max-width:1080px;margin:0 auto;padding:32px 24px 64px}
  header{margin-bottom:24px}
  .brand{font-family:var(--display);font-size:30px;font-weight:900;letter-spacing:.4px}
  .brand span{color:var(--amber)}
  .sub{margin-top:6px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
  .card{padding:16px}
  .big{font-family:var(--display);font-size:34px;font-weight:600;margin-top:6px;line-height:1}
  .split{margin-top:8px;font-size:11px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
  .chartwrap{padding:18px 18px 10px;margin-bottom:18px}
  .chart-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .note{color:var(--muted);font-size:12px;line-height:1.55;max-width:74ch;margin:8px 0 14px}
  .note em{color:var(--ink);font-style:normal;border-bottom:1px dotted var(--faint)}
  .toggle{display:flex;gap:4px;align-items:center}
  .toggle .div{width:1px;height:18px;background:var(--line);margin:0 6px}
  .toggle button{background:transparent;border:1px solid var(--line);color:var(--muted);
     padding:5px 10px;border-radius:7px;font-size:11px}
  .toggle button.active{border-color:var(--amber);color:var(--amber);background:rgba(246,196,84,.08)}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
  th{ text-align:left;color:var(--faint);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
  td{padding:7px 8px;border-bottom:1px solid var(--bg-soft)}
  .r{text-align:right}.faint{color:var(--faint)}
  .loading{padding:48px;text-align:center;color:var(--faint)}
  footer{margin-top:28px;text-align:center}
  code{color:var(--amber-soft)}
  @media(max-width:760px){.cards{grid-template-columns:repeat(2,1fr)}.diag-grid{grid-template-columns:1fr}}
  .diag{padding:18px;margin-bottom:18px}
  .diag-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:12px}
  .diag-box .big{font-size:26px;margin-top:10px}
  .diag-box .big.small{font-size:20px}
  .unit{font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:8px;font-weight:400}
  .stack{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:12px 0 8px;background:var(--bg-soft)}
  .seg.rec{background:#7d8aa8}.seg.new{background:var(--amber)}
  .legend{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
  .legend b{color:var(--ink)}
  .hint{color:var(--muted);font-size:11px;line-height:1.5;margin:10px 0 0}
  .hint em{color:var(--ink);font-style:normal}
  .pill{display:inline-block;margin-top:10px;padding:3px 9px;border:1px solid;border-radius:999px;font-size:11px}
  .evlegend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
  .evkey{display:inline-flex;gap:5px;align-items:center;font-size:12px;color:var(--muted)}
  .evkey i{width:10px;height:10px;border-radius:2px;display:inline-block;opacity:.85}
</style>
