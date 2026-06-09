<script lang="ts">
    import Chart from '$lib/components/Chart.svelte';
    import type {
        MadResponse,
        DiagnoseResponse,
        ChartLine,
        ChartBars,
        TimelineEvent,
    } from '$lib/types';
    import { partnerColor } from '$lib/colors';
    import { fmt, weekday } from '$lib/format';

    let {
        mad,
        diag,
        events,
        windowStart,
        days,
        onDays,
        onSelectDay,
    }: {
        mad: MadResponse;
        diag: DiagnoseResponse;
        events: TimelineEvent[];
        windowStart: string | null;
        days: number;
        onDays: (d: number) => void;
        onSelectDay?: (day: string) => void;
    } = $props();

    // mad/diag are now full-extent — slice to the last `days` days before building series.
    function sliceByDays<T extends { day: string }>(rows: T[], days: number): T[] {
        if (!rows.length || days >= 100000) return rows;
        const max = rows[rows.length - 1].day;
        const cutoff = new Date(
            Date.UTC(+max.slice(0, 4), +max.slice(5, 7) - 1, +max.slice(8, 10)) - days * 86400000,
        )
            .toISOString()
            .slice(0, 10);
        return rows.filter((r) => r.day > cutoff);
    }
    const wWindowed = $derived(sliceByDays(mad.windowed, days));
    const wDaily = $derived(sliceByDays(mad.daily, days));
    const wApi = $derived(sliceByDays(mad.api, days));
    const wCohort = $derived(sliceByDays(diag.cohort, days));

    // Build chart series from the sliced windowed + daily payloads.
    const lines = $derived<ChartLine[]>([
        {
            name: 'MAD (28d)',
            color: 'var(--amber)',
            data: wWindowed.map((d) => ({ day: d.day, value: d.all_devs })),
        },
        {
            name: 'single-chain',
            color: 'var(--cyan)',
            data: wWindowed.map((d) => ({ day: d.day, value: d.exclusive_devs })),
        },
        {
            name: 'multi-chain',
            color: 'var(--rose)',
            data: wWindowed.map((d) => ({ day: d.day, value: d.multichain_devs })),
        },
        ...(wApi.length
            ? [
                  {
                      name: 'API total',
                      color: 'var(--amber-soft)',
                      dash: '4 3',
                      data: wApi.map((d) => ({ day: d.day, value: d.total as number })),
                  },
              ]
            : []),
        ...(wCohort.length
            ? [
                  {
                      name: 'retained devs (prior 28d)',
                      color: '#7d8aa8',
                      dash: '2 3',
                      data: wCohort.map((d) => ({ day: d.day, value: d.recurring })),
                  },
              ]
            : []),
    ]);
    const bars = $derived<ChartBars | null>({
        name: 'daily active',
        color: 'var(--amber)',
        data: wDaily.map((d) => ({ day: d.day, value: d.daily_active_devs })),
    });

    // The chart's floating tooltip used to overlap the (most interesting) right edge of the plot.
    // Instead, the chart reports the hovered day and we render a fixed readout strip above it —
    // never covering the data. When nothing is hovered it falls back to the latest day so the
    // strip stays useful and the layout never shifts.
    let hovered = $state<string | null>(null);
    const lastDay = $derived(wWindowed.length ? wWindowed[wWindowed.length - 1].day : null);
    // Keep every series on its own fixed row — when a day has no point for a series
    // (e.g. the weekly "API total" between samples), show a dash rather than dropping
    // the row, so the box never grows or shrinks as you sweep across days.
    const readout = $derived.by(() => {
        const day = hovered ?? lastDay;
        if (!day) return null;
        const items = lines.map((l) => ({
            color: l.color,
            mark: '●',
            name: l.name,
            value: l.data.find((d) => d.day === day)?.value ?? null,
        }));
        if (bars) {
            items.push({
                color: bars.color,
                mark: '▮',
                name: bars.name,
                value: bars.data.find((d) => d.day === day)?.value ?? null,
            });
        }
        return { day, live: hovered != null, items };
    });
</script>

<section class="panel chartwrap">
    <div class="head">
        <div class="head-main">
            <h2>MAD vs. daily activity</h2>
            <p class="note">
                The bold line is the 28-day rolling MAD (what Developer Report plots). Faint bars
                are <em>daily</em> active devs. When the windowed line falls while the daily bars hold
                steady, you're seeing a past surge roll off the back of the window — not an exodus. Click
                any day to inspect it.
            </p>
            {#if events.length}
                <div class="evlegend">
                    <span class="mono-label">programs</span>
                    {#each [...new Set(events.map((e) => e.partner))] as p (p)}
                        <span class="evkey"><i style={`background:${partnerColor(p)}`}></i>{p}</span>
                    {/each}
                </div>
            {/if}
        </div>
        <div class="head-side">
            <div class="toggle">
                {#each [60, 90, 120, 365, 100000] as d (d)}
                    <button class:active={days === d} onclick={() => onDays(d)}
                        >{d >= 100000 ? 'all' : d + 'd'}</button
                    >
                {/each}
            </div>
            {#if readout}
                <div class="readout" class:live={readout.live}>
                    <div class="readout-day">
                        <span class="readout-date">{readout.day}</span>
                        <span class="readout-wd">{weekday(readout.day)}</span>
                        <span class="readout-tag">{readout.live ? 'hovering' : 'latest'}</span>
                    </div>
                    {#each readout.items as it (it.name)}
                        <div class="readout-item" class:muted={it.value == null}>
                            <span class="dot" style={`color:${it.color}`}>{it.mark}</span>
                            <span class="readout-name">{it.name}</span>
                            <b class="tnum">{fmt(it.value)}</b>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
    <Chart
        {lines}
        {bars}
        {events}
        {windowStart}
        {onSelectDay}
        onHover={(d) => (hovered = d)}
        horizon={mad.meta?.parquet_horizon}
    />
</section>

<style>
    /* Two columns: explanatory text on the left, controls + readout on the right —
       so the readout fills the space under the toggles and beside the note. */
    .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px 24px;
        flex-wrap: wrap;
    }
    .head-main {
        flex: 1 1 320px;
        min-width: 0;
    }
    .head-side {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        width: 230px;
    }
    .head-side .toggle {
        display: flex;
        gap: 4px;
        align-items: center;
    }
    .evlegend {
        display: flex;
        gap: 14px;
        align-items: center;
        flex-wrap: wrap;
        margin: 0;
    }
    .evkey {
        display: inline-flex;
        gap: 5px;
        align-items: center;
        font-size: 12px;
        color: var(--muted);
    }
    .evkey i {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        display: inline-block;
        opacity: 0.85;
    }
    /* Vertical readout — replaces the old cursor-following tooltip that overlapped the
       (most interesting) right edge of the plot. Each series sits on its own row so the
       numbers never reflow horizontally as you sweep across days. Falls back to the
       latest day when nothing is hovered, so the panel is always populated. */
    .readout {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #0c111b;
        color: var(--muted);
        transition: border-color 0.12s ease;
    }
    .readout.live {
        border-color: var(--amber);
    }
    .readout-day {
        display: flex;
        align-items: baseline;
        gap: 6px;
        margin-bottom: 3px;
        padding-bottom: 5px;
        border-bottom: 1px solid var(--line);
    }
    .readout-date {
        font-family: var(--mono);
        letter-spacing: 0.04em;
        color: var(--ink);
    }
    .readout-wd {
        color: var(--muted);
    }
    .readout-tag {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--faint);
        margin-left: auto;
    }
    .readout.live .readout-tag {
        color: var(--amber);
    }
    .readout-item {
        display: flex;
        align-items: baseline;
        gap: 6px;
    }
    .readout-item.muted {
        opacity: 0.45;
    }
    .readout-item .dot {
        line-height: 1;
        flex: 0 0 auto;
    }
    .readout-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .readout-item b {
        margin-left: auto;
        color: var(--ink);
        padding-left: 8px;
    }
    @media (max-width: 720px) {
        .head-side {
            width: 100%;
            align-items: stretch;
        }
        .head-side .toggle {
            flex-wrap: wrap;
        }
    }
</style>
