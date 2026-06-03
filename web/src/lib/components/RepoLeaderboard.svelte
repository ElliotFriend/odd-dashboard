<script lang="ts">
    import { resolve } from '$app/paths';
    import type { RepoAgg } from '$lib/types';
    import { fmt } from '$lib/format';

    let {
        repos,
        repoWindow = $bindable(28),
        repoBy = $bindable('devs'),
    }: {
        repos: RepoAgg[];
        repoWindow?: number;
        repoBy?: 'devs' | 'commits';
    } = $props();

    // Pick the window's devs/commits, sort by repoBy desc, take the top 30 — client-side.
    const rows = $derived.by(() => {
        const pick = (r: RepoAgg) =>
            repoWindow === 28
                ? { devs: r.d28, commits: r.c28 }
                : repoWindow === 60
                  ? { devs: r.d60, commits: r.c60 }
                  : { devs: r.d90, commits: r.c90 };
        return repos
            .map((r) => ({
                repo: r.repo,
                url: r.url,
                last_active_day: r.last_active_day,
                ...pick(r),
            }))
            .sort((a, b) => (repoBy === 'commits' ? b.commits - a.commits : b.devs - a.devs))
            .slice(0, 30);
    });
</script>

<section class="panel chartwrap">
    <div class="chart-head">
        <h2>Repo leaderboard</h2>
        <div class="toggle">
            {#each [28, 60, 90] as d (d)}<button
                    class:active={repoWindow === d}
                    onclick={() => (repoWindow = d)}>{d}d</button
                >{/each}
            <span class="div"></span>
            <button class:active={repoBy === 'devs'} onclick={() => (repoBy = 'devs')}
                >by devs</button
            >
            <button class:active={repoBy === 'commits'} onclick={() => (repoBy = 'commits')}
                >by commits</button
            >
        </div>
    </div>
    <table>
        <thead
            ><tr
                ><th>#</th><th>repo</th><th class="r">devs</th><th class="r">commits</th><th
                    class="r">last active</th
                ></tr
            ></thead
        >
        <tbody>
            {#each rows as r, i (r.repo)}
                <tr
                    ><td class="faint">{i + 1}</td>
                    <td><a href={resolve('/repo/[...slug]', { slug: r.repo })}>{r.repo}</a></td>
                    <td class="r tnum">{fmt(r.devs)}</td><td class="r tnum">{fmt(r.commits)}</td>
                    <td class="r faint">{r.last_active_day}</td></tr
                >
            {/each}
        </tbody>
    </table>
</section>

<style>
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
</style>
