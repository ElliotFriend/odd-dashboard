<script lang="ts">
    import { page } from '$app/state';
    let { data } = $derived(page);
</script>

<header>
    <div class="brand">✦ <span>STELLAR</span> · developer activity</div>
    <div class="sub mono-label">
        {#if data.meta}snapshot {data.meta.snapshot_version} · parquet through {data.meta
                .parquet_horizon}{/if}
        · source: Open Dev Data by Electric Capital (CC BY 4.0)
    </div>
</header>

<style>
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
</style>
