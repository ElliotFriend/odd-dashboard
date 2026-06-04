<script lang="ts">
    // Props: lines = [{name,color,data:[{day,value}],dash?}], bars = {name,color,data:[{day,value}]}|null
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
    }
    let {
        lines = [],
        bars = null,
        height = 340,
        horizon = null,
        windowStart = null,
        events = [],
        onSelectDay,
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

    // Event bands clipped to the visible window.
    const bands = $derived.by(() => {
        if (!xy || !events.length) return [];
        const first = xy.days[0],
            last = xy.days[xy.days.length - 1];
        return events
            .filter((e) => e.end >= first && e.start <= last)
            .map((e) => {
                const left = xAt(e.start),
                    right = xAt(e.end);
                return {
                    event: e,
                    left,
                    width: Math.max(2, right - left),
                    color: partnerColor(e.partner),
                };
            });
    });

    const eventsOn = (day: string): TimelineEvent[] =>
        events.filter((e) => e.start <= day && day <= e.end);

    // Short weekday for an ISO day, computed in UTC so it never drifts by timezone.
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function weekday(day: string): string {
        const [y, m, d] = day.split('-').map(Number);
        return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    }

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
        onmouseleave={() => (hover = null)}
        onclick={onClick}
    >
        {#if xy}
            {#each bands as b (b.event.title)}
                <rect
                    class="band"
                    x={b.left}
                    y={PAD.t}
                    width={b.width}
                    height={height - PAD.t - PAD.b}
                    fill={b.color}
                    opacity="0.10"
                />
                <line
                    class="band"
                    x1={b.left}
                    x2={b.left}
                    y1={PAD.t}
                    y2={height - PAD.b}
                    stroke={b.color}
                    stroke-width="1"
                    opacity="0.45"
                />
                <text
                    class="band"
                    x={b.left + 4}
                    y={PAD.t + 9}
                    font-size="9"
                    fill={b.color}
                    font-family="var(--mono)">{b.event.title}</text
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
                {#each bars.data as d (d.day)}
                    <rect
                        x={xy.x(d.day) - Math.max(1, xy.innerW / xy.days.length / 2)}
                        y={xy.y(d.value)}
                        width={Math.max(1.2, (xy.innerW / xy.days.length) * 0.7)}
                        height={xy.y(0) - xy.y(d.value)}
                        fill={bars.color}
                        opacity="0.28"
                    />
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

    {#if hover && xy}
        <div class="tip" style={`left:${Math.min(xy.x(hover) + 10, W - 150)}px`}>
            <div class="tip-day">{hover} {weekday(hover)}</div>
            {#each lines as l (l.name)}
                {#each l.data.filter((d) => d.day === hover) as d (d.day)}
                    <div class="tip-row">
                        <span style={`color:${l.color}`}>●</span>
                        {l.name}<b class="tnum">{d.value.toLocaleString()}</b>
                    </div>
                {/each}
            {/each}
            {#if bars}{#each bars.data.filter((d) => d.day === hover) as d (d.day)}
                    <div class="tip-row">
                        <span style={`color:${bars.color};opacity:.5`}>▮</span>
                        {bars.name}<b class="tnum">{d.value.toLocaleString()}</b>
                    </div>
                {/each}{/if}
            {#each eventsOn(hover) as e (e.title)}
                <div class="tip-row">
                    <span style={`color:${partnerColor(e.partner)}`}>▮</span>
                    {e.title}<b>{e.partner}</b>
                </div>
            {/each}
        </div>
    {/if}
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
    .tip {
        position: absolute;
        top: 8px;
        background: #0c111b;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 11px;
        pointer-events: none;
        min-width: 130px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .tip-day {
        color: var(--muted);
        margin-bottom: 4px;
        letter-spacing: 0.06em;
    }
    .tip-row {
        display: flex;
        gap: 6px;
        align-items: baseline;
    }
    .tip-row b {
        margin-left: auto;
    }
    .band {
        pointer-events: none;
    }
</style>
