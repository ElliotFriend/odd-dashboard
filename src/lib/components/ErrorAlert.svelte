<script lang="ts">
    import { AlertCircle, X } from "@lucide/svelte";

    interface Props {
        title?: string;
        message: string;
        dismissible?: boolean;
        onDismiss?: () => void;
        retry?: () => void;
        class?: string;
    }

    let {
        title = "Error",
        message,
        dismissible = true,
        onDismiss,
        retry,
        class: className = "",
    }: Props = $props();

    let dismissed = $state(false);

    function handleDismiss() {
        dismissed = true;
        onDismiss?.();
    }
</script>

{#if !dismissed}
    <div
        class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 {className}"
        role="alert"
    >
        <div class="flex items-start gap-3">
            <AlertCircle class="h-5 w-5 flex-shrink-0 text-destructive" />
            <div class="flex-1">
                <h3 class="font-semibold text-destructive">{title}</h3>
                <p class="mt-1 text-sm text-destructive/90">{message}</p>
                {#if retry}
                    <button
                        onclick={retry}
                        class="mt-2 text-sm font-medium text-destructive underline hover:no-underline"
                    >
                        Try again
                    </button>
                {/if}
            </div>
            {#if dismissible}
                <button
                    onclick={handleDismiss}
                    class="flex-shrink-0 rounded-md p-1 text-destructive/70 hover:bg-destructive/20 hover:text-destructive"
                    aria-label="Dismiss"
                >
                    <X class="h-4 w-4" />
                </button>
            {/if}
        </div>
    </div>
{/if}
