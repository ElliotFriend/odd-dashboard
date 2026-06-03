<script lang="ts">
  import type { MauResponse } from '$lib/types';
  import { fmt, latest } from '$lib/format';

  let { mau }: { mau: MauResponse } = $props();

  // recurring-base estimate: median daily-active over the window (de-surged signal)
  const recurringBase = $derived.by(() => {
    if (!mau?.daily?.length) return null;
    const v = mau.daily.map((d) => d.daily_active_devs).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
</script>

<section class="cards">
  <div class="panel card">
    <div class="mono-label">monthly active devs (28d)</div>
    <div class="big tnum">{fmt(latest(mau.windowed, 'all_devs'))}</div>
    <div class="split">
      <span style="color:var(--cyan)">◆ {fmt(latest(mau.windowed, 'exclusive_devs'))} single</span>
      <span style="color:var(--rose)">◆ {fmt(latest(mau.windowed, 'multichain_devs'))} multi</span>
    </div>
  </div>
  <div class="panel card">
    <div class="mono-label">commits in window (28d)</div>
    <div class="big tnum">{fmt(latest(mau.windowed, 'num_commits'))}</div>
  </div>
  <div class="panel card">
    <div class="mono-label">daily active (latest day)</div>
    <div class="big tnum">{fmt(latest(mau.daily, 'daily_active_devs'))}</div>
    <div class="split">recurring base ≈ {fmt(recurringBase)}/day</div>
  </div>
  <div class="panel card">
    <div class="mono-label">api total (freshest)</div>
    <div class="big tnum">{fmt(latest(mau.api, 'total'))}</div>
    <div class="split">{mau.api?.length ? `as of ${latest(mau.api, 'day')}` : 'run snapshot-api'}</div>
  </div>
</section>

<style>
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
  .card{padding:16px}
  .big{font-family:var(--display);font-size:34px;font-weight:600;margin-top:6px;line-height:1}
  .split{margin-top:8px;font-size:11px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
  @media(max-width:760px){.cards{grid-template-columns:repeat(2,1fr)}}
</style>
