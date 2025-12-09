<script lang="ts">
    interface Props {
        variant?: "text" | "card" | "table" | "circle";
        count?: number;
        height?: string;
        width?: string;
        class?: string;
    }

    let {
        variant = "text",
        count = 1,
        height,
        width,
        class: className = "",
    }: Props = $props();

    const getVariantClasses = (v: typeof variant) => {
        switch (v) {
            case "text":
                return "h-4 w-full rounded";
            case "card":
                return "h-32 w-full rounded-lg";
            case "table":
                return "h-16 w-full rounded";
            case "circle":
                return "h-12 w-12 rounded-full";
            default:
                return "h-4 w-full rounded";
        }
    };

    const variantClass = $derived(getVariantClasses(variant));
    const heightClass = $derived(height ? `h-[${height}]` : "");
    const widthClass = $derived(width ? `w-[${width}]` : "");
</script>

<div class="space-y-3">
    {#each Array(count) as _}
        <div
            class="animate-pulse bg-muted {variantClass} {heightClass} {widthClass} {className}"
            role="status"
            aria-label="Loading"
        >
            <span class="sr-only">Loading...</span>
        </div>
    {/each}
</div>
