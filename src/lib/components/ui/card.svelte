<script lang="ts">
    import { cn } from '$lib/utils/cn';

    type CardProps = {
        class?: string;
        children?: import('svelte').Snippet;
    };

    let { class: className, children }: CardProps = $props();
</script>

<div class={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
    {#if children}
        {@render children()}
    {/if}
</div>

