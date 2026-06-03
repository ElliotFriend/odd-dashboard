<script lang="ts">
    import type { PageData } from './$types';
    import { fmt } from '$lib/format';

    import type { DevRepoRow } from '$lib/types';

    let { data }: { data: PageData } = $props();

    let win = $state<28 | 60 | 90 | 'all'>('all');

    const pick = (r: DevRepoRow) =>
        win === 'all'
            ? { commits: r.c_all, active: r.a_all }
            : win === 28
              ? { commits: r.c28, active: r.a28 }
              : win === 60
                ? { commits: r.c60, active: r.a60 }
                : { commits: r.c90, active: r.a90 };

    const rows = $derived(
        data.dev.repos
            .map((r) => ({ ...r, ...pick(r) }))
            .filter((r) => r.commits > 0)
            .sort((a, b) => b.commits - a.commits),
    );
    const total = $derived(rows.reduce((s, r) => s + r.commits, 0));
    const showName = $derived(
        data.dev.name != null && data.dev.name.toLowerCase() !== data.dev.login.toLowerCase(),
    );
</script>

<a href="/" class="back">← dashboard</a>

<h1>
    @{data.dev.login}{#if showName}<span class="faint">{data.dev.name}</span>{/if}
    <a
        class="ext"
        href={`https://github.com/${data.dev.login}`}
        target="_blank"
        rel="noreferrer noopener">GitHub ↗</a
    >
</h1>

<p class="mono-label">{rows.length} repos · {fmt(total)} commits</p>

<section class="panel chartwrap">
    <div class="toggle">
        {#each [28, 60, 90] as const as w (w)}<button
                class:active={win === w}
                onclick={() => (win = w)}>{w}d</button
            >{/each}
        <span class="div"></span>
        <button class:active={win === 'all'} onclick={() => (win = 'all')}>all</button>
    </div>
    <table>
        <thead>
            <tr
                ><th>#</th><th>repo</th><th class="r">commits</th><th class="r">active days</th><th
                    class="r">last active</th
                ></tr
            >
        </thead>
        <tbody>
            {#each rows as r, i (r.repo)}
                <tr>
                    <td class="faint">{i + 1}</td>
                    <td>
                        <a href={`/repo/${r.repo}`}>{r.repo}</a>
                        <a class="ext" href={r.url} target="_blank" rel="noreferrer noopener">↗</a>
                    </td>
                    <td class="r tnum">{fmt(r.commits)}</td>
                    <td class="r tnum">{fmt(r.active)}</td>
                    <td class="r faint">{r.last_active}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</section>

<style>
    .back {
        display: block;
        margin-bottom: 16px;
        font-size: 12px;
        color: var(--faint);
    }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin-top: 8px;
    }
    th {
        text-align: left;
        color: var(--faint);
        font-weight: 500;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 6px 8px;
        border-bottom: 1px solid var(--line);
    }
    td {
        padding: 7px 8px;
        border-bottom: 1px solid var(--bg-soft);
    }
    .r {
        text-align: right;
    }
    .faint {
        color: var(--faint);
    }
    h1 .faint {
        margin-left: 8px;
        font-size: 13px;
        font-weight: 400;
    }
    .ext {
        font-size: 11px;
        color: var(--faint);
        margin-left: 6px;
    }
</style>
