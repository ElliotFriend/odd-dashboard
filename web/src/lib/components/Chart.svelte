<script lang="ts">
    // Props: lines = [{name,color,data:[{day,value}],dash?}],
    //        bars  = {name,color,data:[{day,value}],stack?:{name,color,data}}|null
    //        (bars.data is the TOTAL height; bars.stack is a segment carved off its top)
    import type { ChartLine, ChartBars, ChartPoint, TimelineEvent } from '$lib/types';
    import { partnerColor } from '$lib/colors';

    interface Props {
        lines?: ChartLine[];
        bars?: ChartBars | null;
        height?: number;
        horizon?: string | null;
        windowStart?: string | null;
        events?: TimelineEvent[];
        onSelectDay?: (day: string) => void;
        onHover?: (day: string | null) => void;
    }
    let {
        lines = [],
        bars = null,
        height = 340,
        horizon = null,
        windowStart = null,
        events = [],
        onSelectDay,
        onHover,
    }: Props = $props();

    const PAD = { l: 52, r: 16, t: 16, b: 28 };
    let W = $state<number>(900);

    const allDays = $derived(
        [
            ...new Set([
                ...lines.flatMap((l) => l.data.map((d) => d.day)),
                ...(bars ? bars.data.map((d) => d.day) : []),
            ]),
        ].sort(),
    );

    const xy = $derived.by(() => {
        const days = allDays;
        if (!days.length) return null;
        const xi = new Map(days.map((d, i) => [d, i]));
        const innerW = W - PAD.l - PAD.r,
            innerH = height - PAD.t - PAD.b;
        const x = (d: string) =>
            PAD.l +
            (days.length < 2 ? innerW / 2 : ((xi.get(d) ?? 0) / (days.length - 1)) * innerW);
        const vals = [
            ...lines.flatMap((l) => l.data.map((d) => d.value)),
            ...(bars ? bars.data.map((d) => d.value) : []),
        ];
        const ymax = Math.max(1, ...vals) * 1.08;
        const y = (v: number) => PAD.t + innerH - (v / ymax) * innerH;
        return { x, y, ymax, innerW, innerH, days };
    });

    // Map any ISO day to an x aligned with the index-based scale, clamped to the
    // plot's day range; interpolate by calendar date between bracketing days when
    // the exact day isn't in the set.
    function xAt(day: string): number {
        if (!xy) return PAD.l;
        const { days, x } = xy;
        const first = days[0],
            last = days[days.length - 1];
        if (day <= first) return x(first);
        if (day >= last) return x(last);
        let i = 1;
        while (i < days.length && days[i] < day) i++;
        const before = days[i - 1],
            after = days[i];
        const span = Date.parse(after) - Date.parse(before) || 1;
        const t = (Date.parse(day) - Date.parse(before)) / span;
        return x(before) + t * (x(after) - x(before));
    }

    // Event bands are full-height fills. Where events overlap in time, the full
    // plot height is SPLIT equally among the concurrent events (a stacked ribbon):
    // one event → full height; three overlapping → each 1/3 height, together still
    // filling the band. The split is computed per x-segment (between the sorted
    // event start/end breakpoints), so the partition tracks actual concurrency.
    const bands = $derived.by(() => {
        if (!xy || !events.length) return { fills: [], labels: [] };
        const first = xy.days[0],
            last = xy.days[xy.days.length - 1];
        const top = PAD.t,
            H = xy.innerH;
        const vis = events
            .filter((e) => e.end >= first && e.start <= last)
            .map((e) => ({
                event: e,
                left: xAt(e.start),
                right: xAt(e.end),
                color: partnerColor(e.partner),
                row: 0,
            }))
            .sort((a, b) => a.left - b.left || a.right - b.right);
        // Stable row per event via greedy interval packing on the date range, so an
        // event keeps the same vertical slot across every segment it spans (ribbons
        // don't cross or jump between segments).
        const rowEnds: number[] = [];
        for (const v of vis) {
            let row = rowEnds.findIndex((end) => v.left >= end);
            if (row === -1) row = rowEnds.length;
            rowEnds[row] = v.right;
            v.row = row;
        }
        // events covering a segment [x0,x1], ordered by their stable row
        const covering = (x0: number, x1: number) =>
            vis
                .filter((v) => v.left <= x0 + 0.01 && v.right >= x1 - 0.01)
                .sort((a, b) => a.row - b.row);
        // breakpoints: every start/end x; the active set is constant between them
        const xs = [...new Set(vis.flatMap((v) => [v.left, v.right]))].sort((a, b) => a - b);
        const fills: {
            key: string;
            x: number;
            w: number;
            y: number;
            h: number;
            color: string;
        }[] = [];
        for (let i = 0; i < xs.length - 1; i++) {
            const x0 = xs[i],
                x1 = xs[i + 1];
            const act = covering(x0, x1);
            if (!act.length) continue;
            const h = H / act.length;
            act.forEach((v, slot) => {
                fills.push({
                    key: `${v.event.title}@${i}`,
                    x: x0,
                    w: Math.max(1, x1 - x0),
                    y: top + slot * h,
                    h,
                    color: v.color,
                });
            });
        }
        // one label + left border per event, sized to its slice in the starting segment
        const labels = vis.map((v) => {
            const segEnd = xs.find((x) => x > v.left + 0.01) ?? v.right;
            const act = covering(v.left, segEnd);
            const k = Math.max(1, act.length);
            const slot = Math.max(0, act.indexOf(v));
            const h = H / k;
            const sliceTop = top + slot * h;
            return {
                key: v.event.title,
                x: v.left + 4,
                y: sliceTop + 10,
                color: v.color,
                title: v.event.title,
                left: v.left,
                y0: sliceTop,
                y1: sliceTop + h,
            };
        });
        return { fills, labels };
    });

    // Bar geometry. `bars.data` is always the TOTAL height; an optional `bars.stack`
    // carves a segment off the TOP of it (the rest is drawn in the base color), so a
    // chart without a stack renders exactly as it did before stacking existed.
    const stackColor = $derived(bars?.stack?.color ?? 'transparent');
    const barGeom = $derived.by(() => {
        if (!xy || !bars) return [];
        const s = new Map((bars.stack?.data ?? []).map((d) => [d.day, d.value]));
        const w = Math.max(1.2, (xy.innerW / xy.days.length) * 0.7);
        const half = Math.max(1, xy.innerW / xy.days.length / 2);
        return bars.data.map((d) => {
            // clamp: the stack is a slice OF the total, never larger than it
            const top = Math.min(s.get(d.day) ?? 0, d.value);
            const base = d.value - top;
            return {
                day: d.day,
                x: xy.x(d.day) - half,
                w,
                baseY: xy.y(base),
                baseH: xy.y(0) - xy.y(base),
                topY: xy.y(d.value),
                topH: xy.y(base) - xy.y(d.value),
            };
        });
    });

    function path(data: ChartPoint[], x: (day: string) => number, y: (value: number) => number) {
        return data
            .map((d, i) => `${i ? 'L' : 'M'}${x(d.day).toFixed(1)},${y(d.value).toFixed(1)}`)
            .join(' ');
    }
    const ticks = $derived(xy ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(xy.ymax * f)) : []);

    // The day whose x is nearest a pixel offset within the plot (used by hover + click).
    function nearestDay(px: number): string | null {
        if (!xy) return null;
        let best: string | null = null,
            bd = 1e9;
        for (const d of xy.days) {
            const dist = Math.abs(xy.x(d) - px);
            if (dist < bd) {
                bd = dist;
                best = d;
            }
        }
        return best;
    }

    // hover
    let hover = $state<string | null>(null);
    function pxOf(e: MouseEvent & { currentTarget: EventTarget & SVGSVGElement }): number {
        return e.clientX - e.currentTarget.getBoundingClientRect().left;
    }
    function onMove(e: MouseEvent & { currentTarget: EventTarget & SVGSVGElement }) {
        hover = nearestDay(pxOf(e));
        onHover?.(hover);
    }
    function onClick(e: MouseEvent & { currentTarget: EventTarget & SVGSVGElement }) {
        const day = nearestDay(pxOf(e));
        if (day && onSelectDay) onSelectDay(day);
    }
</script>

<div class="chart" bind:clientWidth={W}>
    <!-- Click-to-inspect-day is a pointer enhancement; the day route is reachable by keyboard
         via its date picker, prev/next links, and the repo/dev leaderboards. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label="time series chart"
        class:clickable={!!onSelectDay}
        onmousemove={onMove}
        onmouseleave={() => {
            hover = null;
            onHover?.(null);
        }}
        onclick={onClick}
    >
        {#if xy}
            <!-- full-height fills, split equally where events overlap -->
            {#each bands.fills as f (f.key)}
                <rect
                    class="band"
                    x={f.x}
                    y={f.y}
                    width={f.w}
                    height={f.h}
                    fill={f.color}
                    opacity="0.12"
                />
            {/each}
            {#each bands.labels as b (b.key)}
                <line
                    class="band"
                    x1={b.left}
                    x2={b.left}
                    y1={b.y0}
                    y2={b.y1}
                    stroke={b.color}
                    stroke-width="1"
                    opacity="0.45"
                />
                <text
                    class="band"
                    x={b.x}
                    y={b.y}
                    font-size="9"
                    fill={b.color}
                    font-family="var(--mono)">{b.title}</text
                >
            {/each}

            {#each ticks as t (t)}
                <line
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={xy.y(t)}
                    y2={xy.y(t)}
                    stroke="var(--grid)"
                    stroke-width="1"
                />
                <text
                    x={PAD.l - 8}
                    y={xy.y(t) + 3}
                    text-anchor="end"
                    font-size="10"
                    fill="var(--faint)"
                    font-family="var(--mono)">{t.toLocaleString()}</text
                >
            {/each}

            {#if bars}
                {#each barGeom as b (b.day)}
                    {#if b.baseH > 0}
                        <rect
                            x={b.x}
                            y={b.baseY}
                            width={b.w}
                            height={b.baseH}
                            fill={bars.color}
                            opacity="0.28"
                        />
                    {/if}
                    {#if b.topH > 0}
                        <rect
                            x={b.x}
                            y={b.topY}
                            width={b.w}
                            height={b.topH}
                            fill={stackColor}
                            opacity="0.28"
                        />
                    {/if}
                {/each}
            {/if}

            {#each lines as l (l.name)}
                <path
                    d={path(l.data, xy.x, xy.y)}
                    fill="none"
                    stroke={l.color}
                    stroke-width="2"
                    stroke-dasharray={l.dash || 'none'}
                    stroke-linejoin="round"
                />
            {/each}

            {#if windowStart}
                <line
                    x1={xAt(windowStart)}
                    x2={xAt(windowStart)}
                    y1={PAD.t}
                    y2={height - PAD.b}
                    stroke="var(--muted)"
                    stroke-width="1"
                    stroke-dasharray="3 3"
                    opacity="0.6"
                />
                <text
                    x={xAt(windowStart) + 4}
                    y={height - PAD.b - 4}
                    text-anchor="start"
                    font-size="9"
                    fill="var(--muted)"
                    font-family="var(--mono)">28-day window →</text
                >
            {/if}

            {#if horizon}
                <line
                    x1={xy.x(horizon)}
                    x2={xy.x(horizon)}
                    y1={PAD.t}
                    y2={height - PAD.b}
                    stroke="var(--muted)"
                    stroke-width="1"
                    stroke-dasharray="3 3"
                    opacity="0.6"
                />
                <text
                    x={xy.x(horizon) - 4}
                    y={height - PAD.b - 4}
                    text-anchor="end"
                    font-size="9"
                    fill="var(--muted)"
                    font-family="var(--mono)">parquet horizon</text
                >
            {/if}

            <!-- x labels: first, middle, last -->
            {#each [xy.days[0], xy.days[Math.floor(xy.days.length / 2)], xy.days[xy.days.length - 1]] as d (d)}
                <text
                    x={xy.x(d)}
                    y={height - 8}
                    text-anchor="middle"
                    font-size="10"
                    fill="var(--faint)"
                    font-family="var(--mono)">{d?.slice(5)}</text
                >
            {/each}

            {#if hover}
                <line
                    x1={xy.x(hover)}
                    x2={xy.x(hover)}
                    y1={PAD.t}
                    y2={height - PAD.b}
                    stroke="var(--amber)"
                    stroke-width="1"
                    opacity="0.5"
                />
                {#each lines as l (l.name)}
                    {#each l.data.filter((d) => d.day === hover) as d (d.day)}
                        <circle
                            cx={xy.x(d.day)}
                            cy={xy.y(d.value)}
                            r="3.5"
                            fill={l.color}
                            stroke="var(--bg)"
                            stroke-width="1.5"
                        />
                    {/each}
                {/each}
            {/if}
        {/if}
    </svg>
</div>

<style>
    .chart {
        position: relative;
        width: 100%;
    }
    svg {
        width: 100%;
        display: block;
    }
    svg.clickable {
        cursor: pointer;
    }
    .band {
        pointer-events: none;
    }
</style>
