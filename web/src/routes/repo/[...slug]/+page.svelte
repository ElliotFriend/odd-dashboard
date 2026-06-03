<script lang="ts">
  import type { PageData } from './$types';
  import { fmt } from '$lib/format';

  let { data }: { data: PageData } = $props();

  const total = $derived(data.repo.devs.reduce((s, d) => s + d.commits, 0));
</script>

<a href="/" class="back">← dashboard</a>

<h1>
  {data.repo.repo}
  <a class="ext" href={data.repo.url} target="_blank" rel="noreferrer noopener">GitHub ↗</a>
</h1>

<p class="mono-label">{data.repo.devs.length} developers · {fmt(total)} commits</p>

<section class="panel chartwrap">
  <table>
    <thead>
      <tr><th>#</th><th>developer</th><th class="r">commits</th><th class="r">active days</th><th class="r">last active</th></tr>
    </thead>
    <tbody>
      {#each data.repo.devs as d, i (d.dev)}
        <tr>
          <td class="faint">{i + 1}</td>
          <td>
            {#if d.login}
              <a href={`/dev/${d.login}`}>@{d.login}</a>
              {#if d.name && d.name.toLowerCase() !== d.login.toLowerCase()}<span class="faint">{d.name}</span>{/if}
              <a class="ext" href={`https://github.com/${d.login}`} target="_blank" rel="noreferrer noopener">↗</a>
            {:else}
              {d.name ?? `developer #${d.dev}`}
            {/if}
          </td>
          <td class="r tnum">{fmt(d.commits)}</td>
          <td class="r tnum">{fmt(d.days)}</td>
          <td class="r faint">{d.last_active}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .back{display:block;margin-bottom:16px;font-size:12px;color:var(--faint)}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
  th{text-align:left;color:var(--faint);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid var(--line)}
  td{padding:7px 8px;border-bottom:1px solid var(--bg-soft)}
  .r{text-align:right}
  .faint{color:var(--faint)}
  td .faint{margin-left:8px;font-size:12px}
  .ext{font-size:11px;color:var(--faint);margin-left:6px}
</style>
