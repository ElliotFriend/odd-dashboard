<script lang="ts">
    import Header from '$lib/components/ui/Header.svelte';
    import Footer from '$lib/components/ui/Footer.svelte';

    import '../app.css';

    import type { LayoutProps } from './$types';
    let { children }: LayoutProps = $props();
</script>

<div class="wrap">
    <Header />
    {@render children()}
    <Footer />
</div>

<style>
    .wrap {
        max-width: 1080px;
        margin: 0 auto;
        padding: 32px 24px 64px;
    }
</style>
