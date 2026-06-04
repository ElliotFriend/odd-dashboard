<script lang="ts">
    import { resolve } from '$app/paths';
    import { goto } from '$app/navigation';
    import { SvelteSet } from 'svelte/reactivity';
    import type { PageData } from './$types';
    import { fmt } from '$lib/format';
    import type { DayPair } from '$lib/types';

    let { data }: { data: PageData } = $props();
    const d = $derived(data.day);

    // UTC weekday (same logic as Chart.svelte) — never drifts by timezone.
    const WEEKDAYS = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ];
    const weekday = $derived.by(() => {
        const [y, m, dd] = d.date.split('-').map(Number);
        return WEEKDAYS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
    });

    // Totals from the pairs payload (self-consistent with daily_activity).
    const totals = $derived.by(() => {
        const devs = new Set<number>(),
            repos = new Set<number>();
        let commits = 0;
        for (const p of d.pairs) {
            devs.add(p.dev);
            repos.add(p.repo_id);
            commits += p.commits;
        }
        return { devs: devs.size, repos: repos.size, commits };
    });
    const retPct = $derived(
        d.cohort.total ? Math.round((d.cohort.returning / d.cohort.total) * 100) : 0,
    );

    interface RepoGroup {
        repo_id: number;
        repo: string;
        url: string;
        commits: number;
        devs: DayPair[];
    }
    interface DevGroup {
        dev: number;
        name: string | null;
        login: string | null;
        is_bot: boolean;
        commits: number;
        repos: DayPair[];
    }

    // Group the flat pairs two ways; each group's children sorted by commits desc.
    const byRepo = $derived.by(() => {
        const m = new Map<number, RepoGroup>();
        for (const p of d.pairs) {
            let g = m.get(p.repo_id);
            if (!g) {
                g = { repo_id: p.repo_id, repo: p.repo, url: p.url, commits: 0, devs: [] };
                m.set(p.repo_id, g);
            }
            g.commits += p.commits;
            g.devs.push(p);
        }
        for (const g of m.values()) g.devs.sort((a, b) => b.commits - a.commits);
        return [...m.values()];
    });
    const byDev = $derived.by(() => {
        const m = new Map<number, DevGroup>();
        for (const p of d.pairs) {
            let g = m.get(p.dev);
            if (!g) {
                g = {
                    dev: p.dev,
                    name: p.name,
                    login: p.login,
                    is_bot: p.is_bot,
                    commits: 0,
                    repos: [],
                };
                m.set(p.dev, g);
            }
            g.commits += p.commits;
            g.repos.push(p);
        }
        for (const g of m.values()) g.repos.sort((a, b) => b.commits - a.commits);
        return [...m.values()];
    });

    let repoBy = $state<'commits' | 'devs'>('commits');
    let devBy = $state<'commits' | 'repos'>('commits');
    const repos = $derived(
        [...byRepo].sort((a, b) =>
            repoBy === 'commits' ? b.commits - a.commits : b.devs.length - a.devs.length,
        ),
    );
    const devs = $derived(
        [...byDev].sort((a, b) =>
            devBy === 'commits' ? b.commits - a.commits : b.repos.length - a.repos.length,
        ),
    );

    // Inline expand state — SvelteSet so in-place add/delete is reactive.
    const openRepos = new SvelteSet<number>();
    const openDevs = new SvelteSet<number>();
    function toggle(set: SvelteSet<number>, id: number) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
    }

    function pickDate(e: Event & { currentTarget: HTMLInputElement }) {
        if (e.currentTarget.value) goto(resolve('/day/[date]', { date: e.currentTarget.value }));
    }
</script>

<a href={resolve('/')} class="back">← dashboard</a>

<div class="nav">
    {#if d.prev}<a class="navbtn" href={resolve('/day/[date]', { date: d.prev })}>‹ prev</a>
    {:else}<span class="navbtn disabled">‹ prev</span>{/if}
    <input type="date" value={d.date} min={d.earliest} max={d.latest} onchange={pickDate} />
    {#if d.next}<a class="navbtn" href={resolve('/day/[date]', { date: d.next })}>next ›</a>
    {:else}<span class="navbtn disabled">next ›</span>{/if}
    {#if d.date !== d.latest}<a class="navbtn" href={resolve('/day/[date]', { date: d.latest })}
            >latest</a
        >{/if}
</div>

<h1>{d.date} <span class="faint">{weekday}</span></h1>

{#if d.pairs.length === 0}
    <p class="mono-label">No developer activity recorded on this day.</p>
{:else}
    <div class="stats">
        <div class="stat"><b class="tnum">{fmt(totals.devs)}</b><span>active devs</span></div>
        <div class="stat"><b class="tnum">{fmt(totals.commits)}</b><span>commits</span></div>
        <div class="stat"><b class="tnum">{fmt(totals.repos)}</b><span>repos touched</span></div>
        <div class="stat">
            <b class="tnum">{fmt(d.cohort.returning)} / {fmt(d.cohort.fresh)}</b>
            <span>returning / new (28d) · {retPct}% returning</span>
        </div>
    </div>

    <div class="cols">
    <section class="panel">
        <div class="phead">
            <h2>repos active</h2>
            <div class="toggle">
                <button class:active={repoBy === 'commits'} onclick={() => (repoBy = 'commits')}
                    >commits</button
                >
                <button class:active={repoBy === 'devs'} onclick={() => (repoBy = 'devs')}
                    >devs</button
                >
            </div>
        </div>
        <table>
            <thead>
                <tr
                    ><th></th><th>repo</th><th class="r">commits</th><th class="r">devs</th></tr
                >
            </thead>
            <tbody>
                {#each repos as g (g.repo_id)}
                    {@const open = openRepos.has(g.repo_id)}
                    <tr>
                        <td class="exptd"
                            ><button
                                class="exp"
                                aria-expanded={open}
                                aria-label="toggle developers"
                                onclick={() => toggle(openRepos, g.repo_id)}
                                >{open ? '▾' : '▸'}</button
                            ></td
                        >
                        <td>
                            <a href={resolve('/repo/[...slug]', { slug: g.repo })}>{g.repo}</a>
                            <a
                                class="ext"
                                href={g.url}
                                target="_blank"
                                rel="external noreferrer noopener">↗</a
                            >
                        </td>
                        <td class="r tnum">{fmt(g.commits)}</td>
                        <td class="r tnum">{fmt(g.devs.length)}</td>
                    </tr>
                    {#if open}
                        <tr class="sub">
                            <td></td>
                            <td colspan="3">
                                <ul class="sublist">
                                    {#each g.devs as p (p.dev)}
                                        <li>
                                            {#if p.login}
                                                <a href={resolve('/dev/[login]', { login: p.login })}
                                                    >@{p.login}</a
                                                >
                                            {:else}
                                                <span class="faint"
                                                    >{p.name ?? `developer #${p.dev}`}</span
                                                >
                                            {/if}
                                            {#if p.is_bot}<span class="bot">bot</span>{/if}
                                            <span class="faint tnum">{fmt(p.commits)}</span>
                                        </li>
                                    {/each}
                                </ul>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    </section>

    <section class="panel">
        <div class="phead">
            <h2>developers active</h2>
            <div class="toggle">
                <button class:active={devBy === 'commits'} onclick={() => (devBy = 'commits')}
                    >commits</button
                >
                <button class:active={devBy === 'repos'} onclick={() => (devBy = 'repos')}
                    >repos</button
                >
            </div>
        </div>
        <table>
            <thead>
                <tr
                    ><th></th><th>developer</th><th class="r">commits</th><th class="r">repos</th
                    ></tr
                >
            </thead>
            <tbody>
                {#each devs as g (g.dev)}
                    {@const open = openDevs.has(g.dev)}
                    <tr>
                        <td class="exptd"
                            ><button
                                class="exp"
                                aria-expanded={open}
                                aria-label="toggle repos"
                                onclick={() => toggle(openDevs, g.dev)}
                                >{open ? '▾' : '▸'}</button
                            ></td
                        >
                        <td>
                            {#if g.login}
                                <a href={resolve('/dev/[login]', { login: g.login })}>@{g.login}</a>
                                {#if g.name && g.name.toLowerCase() !== g.login.toLowerCase()}<span
                                        class="faint">{g.name}</span
                                    >{/if}
                                <a
                                    class="ext"
                                    href={`https://github.com/${g.login}`}
                                    target="_blank"
                                    rel="noreferrer noopener">↗</a
                                >
                            {:else}
                                {g.name ?? `developer #${g.dev}`}
                            {/if}
                            {#if g.is_bot}<span class="bot">bot</span>{/if}
                        </td>
                        <td class="r tnum">{fmt(g.commits)}</td>
                        <td class="r tnum">{fmt(g.repos.length)}</td>
                    </tr>
                    {#if open}
                        <tr class="sub">
                            <td></td>
                            <td colspan="3">
                                <ul class="sublist">
                                    {#each g.repos as p (p.repo_id)}
                                        <li>
                                            <a href={resolve('/repo/[...slug]', { slug: p.repo })}
                                                >{p.repo}</a
                                            >
                                            <span class="faint tnum">{fmt(p.commits)}</span>
                                        </li>
                                    {/each}
                                </ul>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
    </section>
    </div>
{/if}

<style>
    .back {
        display: block;
        margin-bottom: 16px;
        font-size: 12px;
        color: var(--faint);
    }
    .nav {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
    }
    .navbtn {
        font-size: 12px;
        padding: 4px 10px;
        border: 1px solid var(--line);
        border-radius: 6px;
        color: var(--muted);
        background: var(--bg-soft);
    }
    .navbtn.disabled {
        opacity: 0.4;
    }
    .nav input[type='date'] {
        font: inherit;
        font-size: 12px;
        padding: 3px 8px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--bg-soft);
        color: var(--fg);
        color-scheme: dark;
    }
    h1 {
        margin: 0 0 16px;
    }
    h1 .faint {
        margin-left: 8px;
        font-size: 14px;
        font-weight: 400;
    }
    .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 28px;
        margin-bottom: 20px;
    }
    .stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .stat b {
        font-size: 22px;
    }
    .stat span {
        font-size: 11px;
        color: var(--faint);
        letter-spacing: 0.04em;
    }
    .cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        align-items: start;
    }
    @media (max-width: 860px) {
        .cols {
            grid-template-columns: 1fr;
        }
    }
    .phead {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
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
    .exptd {
        width: 24px;
        padding-right: 0;
    }
    .exp {
        background: none;
        border: none;
        color: var(--faint);
        cursor: pointer;
        font-size: 11px;
        padding: 0 2px;
    }
    .bot {
        margin-left: 6px;
        font-size: 10px;
        color: var(--faint);
        border: 1px solid var(--line);
        border-radius: 4px;
        padding: 0 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    tr.sub td {
        border-bottom: 1px solid var(--bg-soft);
        padding-top: 0;
    }
    .sublist {
        list-style: none;
        margin: 0;
        padding: 4px 0 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
    }
    .sublist li {
        font-size: 12px;
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
    }
    .sublist .tnum {
        font-size: 11px;
    }
</style>
