<script lang="ts">
    interface Props {
        size?: "sm" | "md" | "lg";
        class?: string;
    }

    let { size = "md", class: className = "" }: Props = $props();

    const sizeClasses = {
        sm: "h-4 w-4",
        md: "h-8 w-8",
        lg: "h-12 w-12",
    };
</script>

<div
    class="animate-spin rounded-full border-2 border-primary border-t-transparent {sizeClasses[
        size
    ]} {className}"
    role="status"
    aria-label="Loading"
>
    <span class="sr-only">Loading...</span>
</div>
