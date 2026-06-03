<script lang="ts">
  import StatCards from '$lib/components/StatCards.svelte';
  import WhatMoved from '$lib/components/WhatMoved.svelte';
  import MauChart from '$lib/components/MauChart.svelte';
  import RepoLeaderboard from '$lib/components/RepoLeaderboard.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let days = $state(120);
  let repoWin = $state(28);
  let repoBy = $state<'devs' | 'commits'>('devs');
</script>

<StatCards mau={data.mau} />
<WhatMoved diag={data.diag} />
<MauChart mau={data.mau} diag={data.diag} events={data.events} windowStart={data.windowStart} bind:days />
<RepoLeaderboard repos={data.repos} bind:repoWindow={repoWin} bind:repoBy />
