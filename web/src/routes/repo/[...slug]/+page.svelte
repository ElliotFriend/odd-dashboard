<script lang="ts">
    import { resolve } from '$app/paths';
    import type { PageData } from './$types';
    import { fmt } from '$lib/format';

    import type { RepoDevRow } from '$lib/types';

    let { data }: { data: PageData } = $props();

    let win = $state<28 | 60 | 90 | 'all'>('all');

    const pick = (r: RepoDevRow) =>
        win === 'all'
            ? { commits: r.c_all, active: r.a_all }
            : win === 28
              ? { commits: r.c28, active: r.a28 }
              : win === 60
                ? { commits: r.c60, active: r.a60 }
                : { commits: r.c90, active: r.a90 };

    const rows = $derived(
        data.repo.devs
            .map((r) => ({ ...r, ...pick(r) }))
            .filter((r) => r.commits > 0)
            .sort((a, b) => b.commits - a.commits),
    );
    const total = $derived(rows.reduce((s, r) => s + r.commits, 0));
</script>

<a href={resolve('/')} class="back">← dashboard</a>

<h1>
    {data.repo.repo}
    <a class="ext" href={data.repo.url} target="_blank" rel="external noreferrer noopener"
        >GitHub ↗</a
    >
</h1>

<p class="mono-label">{rows.length} developers · {fmt(total)} commits</p>

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
                ><th>#</th><th>developer</th><th class="r">commits</th><th class="r">active days</th
                ><th class="r">last active</th></tr
            >
        </thead>
        <tbody>
            {#each rows as d, i (d.dev)}
                <tr>
                    <td class="faint">{i + 1}</td>
                    <td>
                        {#if d.login}
                            <a href={resolve('/dev/[login]', { login: d.login })}>@{d.login}</a>
                            {#if d.name && d.name.toLowerCase() !== d.login.toLowerCase()}<span
                                    class="faint">{d.name}</span
                                >{/if}
                            <a
                                class="ext"
                                href={`https://github.com/${d.login}`}
                                target="_blank"
                                rel="noreferrer noopener">↗</a
                            >
                        {:else}
                            {d.name ?? `developer #${d.dev}`}
                        {/if}
                    </td>
                    <td class="r tnum">{fmt(d.commits)}</td>
                    <td class="r tnum">{fmt(d.active)}</td>
                    <td class="r faint">{d.last_active}</td>
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
    td .faint {
        margin-left: 8px;
        font-size: 12px;
    }
    .ext {
        font-size: 11px;
        color: var(--faint);
        margin-left: 6px;
    }
</style>
