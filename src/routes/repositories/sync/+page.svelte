<script lang="ts">
    import { goto } from "$app/navigation";
    import { RefreshCw, ArrowLeft, CircleCheck, CircleX, CircleAlert, Clock } from "@lucide/svelte";
    import Card from "$lib/components/ui/card.svelte";
    import CardHeader from "$lib/components/ui/card-header.svelte";
    import CardContent from "$lib/components/ui/card-content.svelte";
    import Button from "$lib/components/ui/button.svelte";
    import LoadingState from "$lib/components/LoadingState.svelte";
    import ErrorAlert from "$lib/components/ErrorAlert.svelte";

    interface SyncResult {
        totalProcessed: number;
        successful: number;
        failed: number;
        markedMissing: number;
        totalCommitsCreated: number;
        totalAuthorsCreated: number;
        results: Array<{
            repositoryId: number;
            fullName: string;
            status: "success" | "failed" | "missing";
            commitsCreated?: number;
            authorsCreated?: number;
            error?: string;
        }>;
    }

    let olderThan = $state("24h");
    let skipMissing = $state(true);
    let syncing = $state(false);
    let error = $state<string | null>(null);
    let result = $state<SyncResult | null>(null);

    const timePeriods = [
        { value: "24h", label: "24 hours" },
        { value: "7d", label: "7 days" },
        { value: "30d", label: "30 days" },
        { value: "never", label: "Never synced" },
    ];

    async function handleSync() {
        syncing = true;
        error = null;
        result = null;

        try {
            const response = await fetch("/api/repositories/sync-batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    olderThan,
                    skipMissing,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to sync repositories");
            }

            result = data.data;
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to sync repositories";
        } finally {
            syncing = false;
        }
    }

    function reset() {
        result = null;
        error = null;
    }
</script>

<div class="space-y-6">
    <div class="flex items-center gap-4">
        <Button variant="outline" onclick={() => goto("/repositories")}>
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to Repositories
        </Button>
    </div>

    <div>
        <h1 class="text-3xl font-bold text-slate-900">Batch Sync Repositories</h1>
        <p class="mt-2 text-slate-600">
            Sync commits for repositories that haven't been updated recently
        </p>
    </div>

    <!-- Instructions -->
    <Card>
        <CardHeader>
            <div class="flex items-center gap-2">
                <Clock class="h-5 w-5 text-slate-500" />
                <h2 class="text-lg font-semibold">How It Works</h2>
            </div>
        </CardHeader>
        <CardContent>
            <div class="space-y-3 text-sm">
                <p>
                    This tool syncs commits for repositories based on when they were last synced.
                    Choose a time period to sync all repositories that haven't been updated since
                    then.
                </p>
                <ul class="list-disc space-y-1 pl-5">
                    <li>
                        <strong>24 hours:</strong> Quick daily sync for active repositories
                    </li>
                    <li>
                        <strong>7 days:</strong> Weekly sync for all recent repositories
                    </li>
                    <li>
                        <strong>30 days:</strong> Monthly sync for comprehensive updates
                    </li>
                    <li>
                        <strong>Never synced:</strong> Initial sync for newly imported repositories
                    </li>
                </ul>
                <p class="text-slate-600">
                    Repositories that are deleted, private, or inaccessible will be automatically
                    marked as missing.
                </p>
            </div>
        </CardContent>
    </Card>

    <!-- Sync Configuration -->
    <Card>
        <CardHeader>
            <div class="flex items-center gap-2">
                <RefreshCw class="h-5 w-5 text-slate-500" />
                <h2 class="text-lg font-semibold">Sync Configuration</h2>
            </div>
        </CardHeader>
        <CardContent>
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    handleSync();
                }}
                class="space-y-4"
            >
                <!-- Time Period -->
                <div>
                    <label for="older-than" class="mb-2 block text-sm font-medium text-slate-700">
                        Sync repositories not synced within
                    </label>
                    <select
                        id="older-than"
                        bind:value={olderThan}
                        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                        {#each timePeriods as period}
                            <option value={period.value}>{period.label}</option>
                        {/each}
                    </select>
                    <p class="mt-1 text-xs text-slate-500">
                        Repositories that haven't been synced in this time period will be updated
                    </p>
                </div>

                <!-- Skip Missing -->
                <div>
                    <label class="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            bind:checked={skipMissing}
                            class="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                        />
                        <span class="text-sm font-medium text-slate-700">
                            Skip repositories marked as missing
                        </span>
                    </label>
                    <p class="ml-6 mt-1 text-xs text-slate-500">
                        Don't attempt to sync repositories that were previously marked as deleted or
                        inaccessible
                    </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 pt-2">
                    <Button type="submit" disabled={syncing}>
                        {syncing ? "Syncing..." : "Start Sync"}
                    </Button>
                    <Button variant="outline" type="button" onclick={reset} disabled={syncing}>
                        Reset
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>

    <!-- Loading State -->
    {#if syncing}
        <LoadingState message="Syncing repositories... This may take a while." />
    {/if}

    <!-- Error Alert -->
    {#if error}
        <ErrorAlert title="Sync Failed" message={error} retry={handleSync} />
    {/if}

    <!-- Results -->
    {#if result}
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    {#if result.failed === 0 && result.markedMissing === 0}
                        <CircleCheck class="h-5 w-5 text-green-600" />
                    {:else if result.successful > 0}
                        <CircleAlert class="h-5 w-5 text-orange-600" />
                    {:else}
                        <CircleX class="h-5 w-5 text-red-600" />
                    {/if}
                    <h2 class="text-lg font-semibold">Sync Results</h2>
                </div>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    <!-- Summary -->
                    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div class="rounded-md bg-blue-50 p-4">
                            <div class="text-2xl font-bold text-blue-700">
                                {result.totalProcessed}
                            </div>
                            <div class="text-sm text-blue-600">Total processed</div>
                        </div>
                        <div class="rounded-md bg-green-50 p-4">
                            <div class="text-2xl font-bold text-green-700">
                                {result.successful}
                            </div>
                            <div class="text-sm text-green-600">Successful</div>
                        </div>
                        <div
                            class="rounded-md p-4"
                            class:bg-orange-50={result.markedMissing > 0}
                            class:bg-slate-50={result.markedMissing === 0}
                        >
                            <div
                                class="text-2xl font-bold"
                                class:text-orange-700={result.markedMissing > 0}
                                class:text-slate-600={result.markedMissing === 0}
                            >
                                {result.markedMissing}
                            </div>
                            <div
                                class="text-sm"
                                class:text-orange-600={result.markedMissing > 0}
                                class:text-slate-500={result.markedMissing === 0}
                            >
                                Marked missing
                            </div>
                        </div>
                        <div
                            class="rounded-md p-4"
                            class:bg-red-50={result.failed > 0}
                            class:bg-slate-50={result.failed === 0}
                        >
                            <div
                                class="text-2xl font-bold"
                                class:text-red-700={result.failed > 0}
                                class:text-slate-600={result.failed === 0}
                            >
                                {result.failed}
                            </div>
                            <div
                                class="text-sm"
                                class:text-red-600={result.failed > 0}
                                class:text-slate-500={result.failed === 0}
                            >
                                Failed
                            </div>
                        </div>
                    </div>

                    <!-- Data Created -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="rounded-md border border-slate-200 p-4">
                            <div class="text-xl font-bold text-slate-900">
                                {result.totalCommitsCreated.toLocaleString()}
                            </div>
                            <div class="text-sm text-slate-600">Commits synced</div>
                        </div>
                        <div class="rounded-md border border-slate-200 p-4">
                            <div class="text-xl font-bold text-slate-900">
                                {result.totalAuthorsCreated.toLocaleString()}
                            </div>
                            <div class="text-sm text-slate-600">New authors</div>
                        </div>
                    </div>

                    <!-- Detailed Results -->
                    {#if result.results.length > 0}
                        <div>
                            <h3 class="mb-2 font-semibold text-slate-900">Details:</h3>
                            <div class="max-h-96 space-y-2 overflow-y-auto">
                                {#each result.results as item}
                                    <div
                                        class="rounded-md border p-3 text-sm"
                                        class:border-green-200={item.status === "success"}
                                        class:bg-green-50={item.status === "success"}
                                        class:border-orange-200={item.status === "missing"}
                                        class:bg-orange-50={item.status === "missing"}
                                        class:border-red-200={item.status === "failed"}
                                        class:bg-red-50={item.status === "failed"}
                                    >
                                        <div class="flex items-start justify-between">
                                            <div class="flex-1">
                                                <div class="flex items-center gap-2">
                                                    {#if item.status === "success"}
                                                        <CircleCheck class="h-4 w-4 text-green-600" />
                                                    {:else if item.status === "missing"}
                                                        <CircleAlert class="h-4 w-4 text-orange-600" />
                                                    {:else}
                                                        <CircleX class="h-4 w-4 text-red-600" />
                                                    {/if}
                                                    <span
                                                        class="font-medium"
                                                        class:text-green-900={item.status ===
                                                            "success"}
                                                        class:text-orange-900={item.status ===
                                                            "missing"}
                                                        class:text-red-900={item.status === "failed"}
                                                    >
                                                        {item.fullName}
                                                    </span>
                                                </div>
                                                {#if item.status === "success"}
                                                    <p class="mt-1 text-green-700">
                                                        {item.commitsCreated} commits, {item.authorsCreated} authors
                                                    </p>
                                                {/if}
                                                {#if item.error}
                                                    <p
                                                        class="mt-1"
                                                        class:text-orange-700={item.status ===
                                                            "missing"}
                                                        class:text-red-700={item.status === "failed"}
                                                    >
                                                        {item.error}
                                                    </p>
                                                {/if}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onclick={() =>
                                                    goto(`/repositories/${item.repositoryId}`)}
                                            >
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Action Buttons -->
                    <div class="flex gap-3">
                        <Button onclick={() => goto("/repositories")}>
                            View All Repositories
                        </Button>
                        <Button variant="outline" onclick={reset}>
                            Sync More
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    {/if}
</div>
