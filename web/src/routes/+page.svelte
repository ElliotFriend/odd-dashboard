<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import StatCards from '$lib/StatCards.svelte';
  import WhatMoved from '$lib/WhatMoved.svelte';
  import MauChart from '$lib/MauChart.svelte';
  import RepoLeaderboard from '$lib/RepoLeaderboard.svelte';

  let { data }: { data: PageData } = $props();

  function setParam(key: 'days' | 'repoWin' | 'repoBy', val: string | number) {
    const p = new URLSearchParams({
      days: String(data.params.days),
      repoWin: String(data.params.repoWin),
      repoBy: data.params.repoBy
    });
    p.set(key, String(val));
    goto('?' + p, { noScroll: true, keepFocus: true });
  }
</script>

<StatCards mau={data.mau} />
<WhatMoved diag={data.diag} />
<MauChart
  mau={data.mau}
  diag={data.diag}
  events={data.events}
  windowStart={data.windowStart}
  days={data.params.days}
  onDays={(d) => setParam('days', d)}
/>
<RepoLeaderboard
  repos={data.repos}
  repoWindow={data.params.repoWin}
  repoBy={data.params.repoBy as 'devs' | 'commits'}
  onWindow={(d) => setParam('repoWin', d)}
  onBy={(v: 'devs' | 'commits') => setParam('repoBy', v)}
/>
