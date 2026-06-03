<script lang="ts">
    import '../app.css';
    import type { Snippet } from 'svelte';
    import type { Meta } from '$lib/types';
    let { data, children }: { data: { meta: Meta }; children: Snippet } = $props();
</script>

<div class="wrap">
    <header>
        <div class="brand">✦ <span>STELLAR</span> · developer activity</div>
        <div class="sub mono-label">
            {#if data.meta}snapshot {data.meta.snapshot_version} · parquet through {data.meta
                    .parquet_horizon}{/if}
            · source: Open Dev Data by Electric Capital (CC BY 4.0)
        </div>
    </header>

    {@render children()}

    <footer class="mono-label">
        stellar_extract.duckdb · rebuild with <code>uv run python stellar_odd.py extract</code>
    </footer>
</div>

<style>
    .wrap {
        max-width: 1080px;
        margin: 0 auto;
        padding: 32px 24px 64px;
    }
    header {
        margin-bottom: 24px;
    }
    .brand {
        font-family: var(--display);
        font-size: 30px;
        font-weight: 900;
        letter-spacing: 0.4px;
    }
    .brand span {
        color: var(--amber);
    }
    .sub {
        margin-top: 6px;
    }
    footer {
        margin-top: 28px;
        text-align: center;
    }
    code {
        color: var(--amber-soft);
    }
</style>
