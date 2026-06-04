<script lang="ts">
    import StatCards from '$lib/components/StatCards.svelte';
    import WhatMoved from '$lib/components/WhatMoved.svelte';
    import MadChart from '$lib/components/MadChart.svelte';
    import Definitions from '$lib/components/Definitions.svelte';
    import RepoLeaderboard from '$lib/components/RepoLeaderboard.svelte';
    import DevLeaderboard from '$lib/components/DevLeaderboard.svelte';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import type { PageData } from './$types';
    let { data }: { data: PageData } = $props();
    let days = $state(120);
    let repoWin = $state(28);
    let repoBy = $state<'devs' | 'commits'>('devs');
    let devWin = $state(28);
    let devBy = $state<'commits' | 'days' | 'repos'>('commits');

    // Chart range is client $state that slices the loaded data. Only the `all` view needs
    // more than the default 365-day load, so crossing that boundary re-loads via ?range=all.
    function onDays(d: number) {
        days = d;
        const wantAll = d >= 100000;
        if (wantAll !== data.full)
            goto(wantAll ? resolve('/?range=all') : resolve('/'), {
                noScroll: true,
                keepFocus: true,
            });
    }
</script>

<StatCards mad={data.mad} />
<WhatMoved diag={data.diag} />
<MadChart
    mad={data.mad}
    diag={data.diag}
    events={data.events}
    windowStart={data.windowStart}
    {days}
    {onDays}
    onSelectDay={(day) => goto(resolve('/day/[date]', { date: day }))}
/>
<Definitions />
<RepoLeaderboard repos={data.repos} bind:repoWindow={repoWin} bind:repoBy />
<DevLeaderboard devs={data.devs} bind:win={devWin} bind:by={devBy} />
