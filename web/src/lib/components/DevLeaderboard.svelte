<script lang="ts">
  import type { DevAgg } from '$lib/types';
  import { fmt } from '$lib/format';

  let {
    devs, win = $bindable(28), by = $bindable('commits')
  }: {
    devs: DevAgg[];
    win?: number;
    by?: 'commits' | 'days' | 'repos';
  } = $props();

  // Pick the chosen window's metrics, sort by `by` desc, take the top 30 — client-side.
  const rows = $derived.by(() => {
    const pick = (d: DevAgg) => win === 28 ? { commits: d.c28, days: d.a28, repos: d.r28 }
      : win === 60 ? { commits: d.c60, days: d.a60, repos: d.r60 } : { commits: d.c90, days: d.a90, repos: d.r90 };
    return devs.map((d) => ({ name: d.name, login: d.login, ...pick(d) }))
      .filter((d) => d.commits > 0)
      .sort((a, b) => b[by] - a[by])
      .slice(0, 30);
  });
</script>

<section class="panel chartwrap">
  <div class="chart-head">
    <h2>Developer leaderboard</h2>
    <div class="toggle">
      {#each [28, 60, 90] as d (d)}<button class:active={win === d} onclick={() => (win = d)}>{d}d</button>{/each}
      <span class="div"></span>
      <button class:active={by === 'commits'} onclick={() => (by = 'commits')}>commits</button>
      <button class:active={by === 'days'} onclick={() => (by = 'days')}>active days</button>
      <button class:active={by === 'repos'} onclick={() => (by = 'repos')}>repos</button>
    </div>
  </div>
  {#if devs.length === 0}
    <p class="note">Run <em>stellar_odd.py resolve-devs</em> to populate developer identities.</p>
  {:else}
    <table>
      <thead><tr><th>#</th><th>developer</th><th class="r">commits</th><th class="r">active days</th><th class="r">repos</th></tr></thead>
      <tbody>
        {#each rows as r, i (r.login ?? r.name ?? i)}
          <tr><td class="faint">{i + 1}</td>
            <td>
              {#if r.login}
                <a href={`https://github.com/${r.login}`} target="_blank" rel="noreferrer noopener">@{r.login}</a>
                {#if r.name && r.name.toLowerCase() !== r.login.toLowerCase()}<span class="faint">{r.name}</span>{/if}
              {:else}
                {r.name ?? '—'}
              {/if}
            </td>
            <td class="r tnum">{fmt(r.commits)}</td><td class="r tnum">{fmt(r.days)}</td>
            <td class="r tnum">{fmt(r.repos)}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
  th{ text-align:left;color:var(--faint);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
  td{padding:7px 8px;border-bottom:1px solid var(--bg-soft)}
  .r{text-align:right}.faint{color:var(--faint)}
  td .faint{margin-left:8px;font-size:12px}
</style>
