<script lang="ts">
  import StatCards from '$lib/components/StatCards.svelte';
  import WhatMoved from '$lib/components/WhatMoved.svelte';
  import MauChart from '$lib/components/MauChart.svelte';
  import RepoLeaderboard from '$lib/components/RepoLeaderboard.svelte';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let days = $state(120);
  let repoWin = $state(28);
  let repoBy = $state<'devs' | 'commits'>('devs');

  // Chart range is client $state that slices the loaded data. Only the `all` view needs
  // more than the default 365-day load, so crossing that boundary re-loads via ?range=all.
  function onDays(d: number) {
    days = d;
    const wantAll = d >= 100000;
    if (wantAll !== data.full) goto(wantAll ? '?range=all' : '?', { noScroll: true, keepFocus: true });
  }
</script>

<StatCards mau={data.mau} />
<WhatMoved diag={data.diag} />
<MauChart mau={data.mau} diag={data.diag} events={data.events} windowStart={data.windowStart} {days} {onDays} />
<RepoLeaderboard repos={data.repos} bind:repoWindow={repoWin} bind:repoBy />
