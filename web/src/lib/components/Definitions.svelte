<script lang="ts">
    // Site-wide glossary — an expandable "legend for the whole dashboard". Static content;
    // defines the metrics shown on the chart, stat cards, cohort split, and leaderboards.
    // The color dots match the chart series so this doubles as a legend.
    const terms: { term: string; color?: string; def: string }[] = [
        {
            term: 'MAD (28d)',
            color: 'var(--amber)',
            def: 'Monthly Active Developers — developers with ≥1 commit in the trailing 28-day window. The headline metric, taken straight from Electric Capital’s Open Dev Data (eco_mads.all_devs). "Monthly" is really a 28-day rolling window, which is why a surge rolls off ~28 days later.',
        },
        {
            term: 'daily active',
            color: 'var(--amber)',
            def: 'Distinct developers who committed on a single calendar day (not windowed). Drawn as the faint bars behind the MAD line.',
        },
        {
            term: 'single-chain (exclusive)',
            color: 'var(--cyan)',
            def: 'Within the window, contributed only to this ecosystem’s repos (or to one of its first-party org repos). MAD = single-chain + multi-chain.',
        },
        {
            term: 'multi-chain',
            color: 'var(--rose)',
            def: 'Within the window, also contributed to other ecosystems.',
        },
        {
            term: 'retained devs (prior 28d)',
            color: '#7d8aa8',
            def: 'Developers in the current 28-day window who were also active in the previous 28-day window — the sustained base. The dashed chart line, and the "retained" share of the cohort split. A MAD spike with no rise here is a transient program/event wave.',
        },
        {
            term: 'new (this window)',
            def: 'Developers in the current 28-day window who were NOT active in the previous one — first-timers, or returners after a gap.',
        },
        {
            term: 'typical daily base',
            def: 'The median number of developers active on a typical day over the last 90 days. Using the median (not the average) makes it robust to surge spikes, so it estimates the steady, always-there population. A daily-scale figure (~130) — distinct from "retained devs", which counts the 28-day window.',
        },
        {
            term: 'commits in window (28d)',
            def: 'Total commits across the trailing 28 days — also a 28-day windowed figure, like MAD.',
        },
        {
            term: 'API total',
            def: 'The freshest MAD value pulled from developerreport.com’s live series (which labels it "MAU"). Usually ~1 day ahead of the public parquet — a cross-check, not a gap-filler.',
        },
        {
            term: 'parquet horizon',
            def: 'The most recent day covered by the Open Dev Data snapshot (~7 days behind today). Marked by a vertical line on the chart.',
        },
    ];
</script>

<details class="panel defs">
    <summary>
        <span class="mono-label">definitions</span>
        <span class="sub">what the metrics on this site mean</span>
    </summary>
    <dl>
        {#each terms as t (t.term)}
            <dt>
                {#if t.color}<i style={`background:${t.color}`}></i>{/if}<span>{t.term}</span>
            </dt>
            <dd>{t.def}</dd>
        {/each}
    </dl>
</details>

<style>
    .defs {
        margin-bottom: 18px;
    }
    summary {
        list-style: none;
        cursor: pointer;
        padding: 14px 18px;
        display: flex;
        align-items: baseline;
        gap: 12px;
    }
    summary::-webkit-details-marker {
        display: none;
    }
    summary::after {
        content: '▸';
        margin-left: auto;
        color: var(--faint);
        font-size: 11px;
    }
    details[open] summary::after {
        content: '▾';
    }
    .sub {
        font-size: 12px;
        color: var(--muted);
    }
    dl {
        margin: 0;
        padding: 14px 18px 16px;
        border-top: 1px solid var(--line);
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 11px 18px;
    }
    dt {
        font-size: 12px;
        color: var(--ink);
        display: flex;
        align-items: baseline;
        gap: 7px;
    }
    dt i {
        width: 9px;
        height: 9px;
        border-radius: 2px;
        flex: none;
        position: relative;
        top: 1px;
    }
    dd {
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--muted);
        max-width: 80ch;
    }
    @media (max-width: 700px) {
        dl {
            grid-template-columns: 1fr;
            gap: 3px 0;
        }
        dd {
            margin-bottom: 10px;
        }
    }
</style>
