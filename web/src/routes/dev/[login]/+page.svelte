<script lang="ts">
  import type { PageData } from './$types';
  import { fmt } from '$lib/format';

  let { data }: { data: PageData } = $props();

  const total = $derived(data.dev.repos.reduce((s, r) => s + r.commits, 0));
  const showName = $derived(
    data.dev.name != null && data.dev.name.toLowerCase() !== data.dev.login.toLowerCase()
  );
</script>

<a href="/" class="back">← dashboard</a>

<h1>
  @{data.dev.login}{#if showName}<span class="faint">{data.dev.name}</span>{/if}
  <a class="ext" href={`https://github.com/${data.dev.login}`} target="_blank" rel="noreferrer noopener">GitHub ↗</a>
</h1>

<p class="mono-label">{data.dev.repos.length} repos · {fmt(total)} commits</p>

<section class="panel chartwrap">
  <table>
    <thead>
      <tr><th>#</th><th>repo</th><th class="r">commits</th><th class="r">active days</th><th class="r">last active</th></tr>
    </thead>
    <tbody>
      {#each data.dev.repos as r, i (r.repo)}
        <tr>
          <td class="faint">{i + 1}</td>
          <td>
            <a href={`/repo/${r.repo}`}>{r.repo}</a>
            <a class="ext" href={r.url} target="_blank" rel="noreferrer noopener">↗</a>
          </td>
          <td class="r tnum">{fmt(r.commits)}</td>
          <td class="r tnum">{fmt(r.days)}</td>
          <td class="r faint">{r.last_active}</td>
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
  h1 .faint{margin-left:8px;font-size:13px;font-weight:400}
  .ext{font-size:11px;color:var(--faint);margin-left:6px}
</style>
