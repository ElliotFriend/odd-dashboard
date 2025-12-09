<script lang="ts">
    import { onMount } from "svelte";
    import type { Component } from "svelte";

    interface Props {
        title: string;
        value: number | string;
        description?: string;
        icon?: Component<any>;
        loading?: boolean;
        trend?: {
            value: number;
            label: string;
        };
    }

    let {
        title,
        value,
        description,
        icon: Icon,
        loading = false,
        trend,
    }: Props = $props();

    // Format large numbers with commas
    function formatNumber(num: number | string): string {
        if (typeof num === "string") return num;
        return num.toLocaleString();
    }
</script>

<div class="rounded-lg border bg-card p-6 shadow-sm">
    <div class="flex items-start justify-between">
        <div class="flex-1">
            <p class="text-sm font-medium text-muted-foreground">{title}</p>
            {#if loading}
                <div class="mt-2 h-8 w-24 animate-pulse rounded bg-muted"></div>
            {:else}
                <p class="mt-2 text-3xl font-bold">{formatNumber(value)}</p>
            {/if}
            {#if description}
                <p class="mt-1 text-xs text-muted-foreground">{description}</p>
            {/if}
            {#if trend}
                <div class="mt-2 flex items-center gap-1">
                    <span
                        class="text-xs font-medium"
                        class:text-green-600={trend.value > 0}
                        class:text-red-600={trend.value < 0}
                        class:text-muted-foreground={trend.value === 0}
                    >
                        {trend.value > 0 ? "+" : ""}{trend.value}%
                    </span>
                    <span class="text-xs text-muted-foreground"
                        >{trend.label}</span
                    >
                </div>
            {/if}
        </div>
        {#if Icon}
            <div class="rounded-full bg-primary/10 p-3">
                <Icon class="h-5 w-5 text-primary" />
            </div>
        {/if}
    </div>
</div>
