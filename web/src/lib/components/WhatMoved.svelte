<script lang="ts">
    import type { DiagnoseResponse } from '$lib/types';
    import { fmt } from '$lib/format';

    let { diag }: { diag: DiagnoseResponse } = $props();

    // current cohort decomposition (latest day of the rolling split)
    const cohortNow = $derived(diag?.cohort?.length ? diag.cohort[diag.cohort.length - 1] : null);
    // fallback 0 (never rendered: every use sits inside {#if cohortNow}) keeps the type non-null
    const retainedPct = $derived(
        cohortNow ? Math.round((100 * cohortNow.recurring) / cohortNow.total) : 0,
    );

    // cluster contiguous surge days (gap > 2 days starts a new run); report the largest recent run
    const surgeRuns = $derived.by(() => {
        const d = diag?.surgeDays ?? [];
        const runs: { start: string; end: string; endNum: number; peak: number }[] = [];
        for (const row of d) {
            const last = runs[runs.length - 1];
            const dayNum = Date.parse(row.day) / 86400000;
            if (last && dayNum - last.endNum <= 2) {
                last.end = row.day;
                last.endNum = dayNum;
                last.peak = Math.max(last.peak, row.devs);
            } else runs.push({ start: row.day, end: row.day, endNum: dayNum, peak: row.devs });
        }
        return runs.filter((r) => r.start !== r.end); // drop lone-day blips
    });
    const lastSurge = $derived(surgeRuns.length ? surgeRuns[surgeRuns.length - 1] : null);

    // intensity read in plain language
    const intensityRead = $derived.by(() => {
        const cpd = diag?.intensity?.commits_per_dev;
        if (cpd == null) return null;
        if (cpd < 8) return { tag: 'drive-by / program-driven', tone: 'rose' };
        if (cpd < 20) return { tag: 'mixed', tone: 'amber' };
        return { tag: 'sustained building', tone: 'cyan' };
    });
</script>

<section class="panel diag">
    <div class="chart-head">
        <h2>What moved the metric</h2>
        <span class="mono-label">28d window · cohort &amp; intensity</span>
    </div>
    <div class="diag-grid">
        <div class="diag-box">
            <div class="mono-label">retained vs. new (this window)</div>
            {#if cohortNow}
                <div class="stack">
                    <div class="seg rec" style={`width:${retainedPct}%`}></div>
                    <div class="seg new" style={`width:${100 - retainedPct}%`}></div>
                </div>
                <div class="legend">
                    <span
                        ><b class="tnum">{fmt(cohortNow.recurring)}</b> retained ({retainedPct}%)</span
                    >
                    <span
                        ><b class="tnum">{fmt(cohortNow.new_devs)}</b> new ({100 -
                            retainedPct}%)</span
                    >
                </div>
                <p class="hint">
                    Retained = also active in the prior 28-day window. A spike in <em>new</em> that later
                    vanishes is a program/event wave, not base growth.
                </p>
            {/if}
        </div>

        <div class="diag-box">
            <div class="mono-label">contributor intensity</div>
            <div class="big tnum">
                {fmt(diag?.intensity?.commits_per_dev)}<span class="unit">commits/dev</span>
            </div>
            {#if intensityRead}
                <span
                    class="pill"
                    style={`color:var(--${intensityRead.tone});border-color:var(--${intensityRead.tone})`}
                    >{intensityRead.tag}</span
                >
                <p class="hint">
                    Low commits-per-dev across many contributors is the signature of drive-by /
                    bounty-program activity — e.g. monthly bounty sprints like <a
                        href="https://www.drips.network/wave/stellar"
                        target="_blank"
                        rel="noreferrer">Drips Wave</a
                    > — rather than sustained team building.
                </p>
            {/if}
        </div>

        <div class="diag-box">
            <div class="mono-label">surge watch</div>
            {#if lastSurge}
                <div class="big small">{lastSurge.start.slice(5)} → {lastSurge.end.slice(5)}</div>
                <div class="hint">
                    Peak ≈ <b class="tnum">{fmt(lastSurge.peak)}</b> daily devs. Activity surges roll
                    off the 28-day window ~28 days later — so a surge here mechanically deflates MAD about
                    four weeks on, even with no change in the retained base.
                </div>
            {:else}<div class="hint">No multi-day surge detected in range.</div>{/if}
        </div>
    </div>
</section>

<style>
    .diag {
        padding: 18px;
        margin-bottom: 18px;
    }
    .diag-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
        margin-top: 12px;
    }
    .diag-box .big {
        font-size: 26px;
        margin-top: 10px;
    }
    .diag-box .big.small {
        font-size: 20px;
    }
    .unit {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--muted);
        margin-left: 8px;
        font-weight: 400;
    }
    .stack {
        display: flex;
        height: 14px;
        border-radius: 7px;
        overflow: hidden;
        margin: 12px 0 8px;
        background: var(--bg-soft);
    }
    .seg.rec {
        background: #7d8aa8;
    }
    .seg.new {
        background: var(--amber);
    }
    .legend {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--muted);
    }
    .legend b {
        color: var(--ink);
    }
    .hint {
        color: var(--muted);
        font-size: 11px;
        line-height: 1.5;
        margin: 10px 0 0;
    }
    .hint em {
        color: var(--ink);
        font-style: normal;
    }
    .pill {
        display: inline-block;
        margin-top: 10px;
        padding: 3px 9px;
        border: 1px solid;
        border-radius: 999px;
        font-size: 11px;
    }
    @media (max-width: 760px) {
        .diag-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
