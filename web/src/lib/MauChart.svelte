<script lang="ts">
  import Chart from '$lib/Chart.svelte';
  import type {
    MauResponse, DiagnoseResponse, ChartLine, ChartBars, TimelineEvent
  } from '$lib/types';
  import { partnerColor } from '$lib/colors';

  let {
    mau, diag, events, windowStart, days, onDays
  }: {
    mau: MauResponse;
    diag: DiagnoseResponse;
    events: TimelineEvent[];
    windowStart: string | null;
    days: number;
    onDays: (d: number) => void;
  } = $props();

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
</script>

<section class="panel chartwrap">
  <div class="chart-head">
    <h2>MAU vs. daily activity</h2>
    <div class="toggle">
      {#each [60, 90, 120, 365, 100000] as d}
        <button class:active={days === d} onclick={() => onDays(d)}>{d >= 100000 ? 'all' : d + 'd'}</button>
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
  <Chart {lines} {bars} {events} {windowStart} horizon={mau.meta?.parquet_horizon} />
</section>

<style>
  .evlegend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
  .evkey{display:inline-flex;gap:5px;align-items:center;font-size:12px;color:var(--muted)}
  .evkey i{width:10px;height:10px;border-radius:2px;display:inline-block;opacity:.85}
</style>
