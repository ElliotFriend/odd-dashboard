<script lang="ts">
    import type { ComponentType } from "svelte";

    interface Props {
        title: string;
        description?: string;
        icon?: ComponentType;
        action?: {
            label: string;
            onclick: () => void;
        };
        class?: string;
    }

    let { title, description, icon: Icon, action, class: className = "" }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center {className}">
    {#if Icon}
        <div class="rounded-full bg-muted p-4 mb-4">
            <Icon class="h-8 w-8 text-muted-foreground" />
        </div>
    {/if}
    <h3 class="text-lg font-semibold text-foreground">{title}</h3>
    {#if description}
        <p class="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
    {/if}
    {#if action}
        <button
            onclick={action.onclick}
            class="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
            {action.label}
        </button>
    {/if}
</div>
