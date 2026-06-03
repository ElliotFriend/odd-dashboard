<script lang="ts">
  import type { ReposResponse } from '$lib/types';
  import { fmt } from '$lib/format';

  let {
    repos, repoWindow, repoBy, onWindow, onBy
  }: {
    repos: ReposResponse;
    repoWindow: number;
    repoBy: 'devs' | 'commits';
    onWindow: (d: number) => void;
    onBy: (v: 'devs' | 'commits') => void;
  } = $props();
</script>

<section class="panel chartwrap">
  <div class="chart-head">
    <h2>Repo leaderboard</h2>
    <div class="toggle">
      {#each [28, 60, 90] as d}<button class:active={repoWindow === d} onclick={() => onWindow(d)}>{d}d</button>{/each}
      <span class="div"></span>
      <button class:active={repoBy === 'devs'} onclick={() => onBy('devs')}>by devs</button>
      <button class:active={repoBy === 'commits'} onclick={() => onBy('commits')}>by commits</button>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>repo</th><th class="r">devs</th><th class="r">commits</th><th class="r">last active</th></tr></thead>
    <tbody>
      {#each repos.rows as r, i}
        <tr><td class="faint">{i + 1}</td>
          <td><a href={r.url || 'https://github.com/' + r.repo} target="_blank" rel="noreferrer noopener">{r.repo}</a></td>
          <td class="r tnum">{fmt(r.devs)}</td><td class="r tnum">{fmt(r.commits)}</td>
          <td class="r faint">{r.last_active_day}</td></tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
  th{ text-align:left;color:var(--faint);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
  td{padding:7px 8px;border-bottom:1px solid var(--bg-soft)}
  .r{text-align:right}.faint{color:var(--faint)}
</style>
