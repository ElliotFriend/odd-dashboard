<script lang="ts">
    import Spinner from "./Spinner.svelte";

    interface Props {
        variant?: "spinner" | "inline" | "page";
        message?: string;
        class?: string;
    }

    let { variant = "spinner", message = "Loading...", class: className = "" }: Props = $props();
</script>

{#if variant === "spinner"}
    <div class="flex items-center justify-center py-12 {className}">
        <div class="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            {#if message}
                <p class="text-sm text-muted-foreground">{message}</p>
            {/if}
        </div>
    </div>
{:else if variant === "inline"}
    <div class="flex items-center gap-2 {className}">
        <Spinner size="sm" />
        {#if message}
            <span class="text-sm text-muted-foreground">{message}</span>
        {/if}
    </div>
{:else if variant === "page"}
    <div class="flex min-h-screen items-center justify-center {className}">
        <div class="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            {#if message}
                <p class="text-sm text-muted-foreground">{message}</p>
            {/if}
        </div>
    </div>
{/if}
