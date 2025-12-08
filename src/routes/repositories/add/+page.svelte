<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { Plus, ArrowLeft, GitBranch, CheckCircle, XCircle, AlertCircle } from "@lucide/svelte";
    import Card from "$lib/components/ui/card.svelte";
    import CardHeader from "$lib/components/ui/card-header.svelte";
    import CardContent from "$lib/components/ui/card-content.svelte";
    import Button from "$lib/components/ui/button.svelte";
    import LoadingState from "$lib/components/LoadingState.svelte";
    import ErrorAlert from "$lib/components/ErrorAlert.svelte";

    interface Event {
        id: number;
        name: string;
        description: string | null;
        startDate: string | null;
        endDate: string | null;
    }

    interface AddResult {
        success: number;
        failed: number;
        skipped: number;
        results: Array<{
            url: string;
            status: "success" | "failed" | "skipped";
            repositoryId?: number;
            error?: string;
        }>;
    }

    let repoUrls = $state("");
    let selectedEventId = $state<number | null>(null);
    let events = $state<Event[]>([]);
    let loading = $state(false);
    let loadingEvents = $state(true);
    let error = $state<string | null>(null);
    let eventsError = $state<string | null>(null);
    let result = $state<AddResult | null>(null);

    async function loadEvents() {
        try {
            loadingEvents = true;
            eventsError = null;

            const response = await fetch("/api/events");
            if (!response.ok) {
                throw new Error("Failed to load events");
            }

            const data = await response.json();
            events = data.data || [];
        } catch (err: any) {
            eventsError = err.message || "Failed to load events";
            console.error("Error loading events:", err);
        } finally {
            loadingEvents = false;
        }
    }

    async function handleSubmit() {
        if (!repoUrls.trim()) {
            error = "Please enter at least one repository URL";
            return;
        }

        loading = true;
        error = null;
        result = null;

        try {
            const response = await fetch("/api/repositories/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    repoUrls: repoUrls.trim(),
                    eventId: selectedEventId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to add repositories");
            }

            result = data.data;
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to add repositories";
        } finally {
            loading = false;
        }
    }

    function reset() {
        repoUrls = "";
        result = null;
        error = null;
        selectedEventId = null;
    }

    onMount(() => {
        loadEvents();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center gap-4">
        <Button variant="outline" onclick={() => goto("/repositories")}>
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to Repositories
        </Button>
    </div>

    <div>
        <h1 class="text-3xl font-bold text-slate-900">Add Repositories</h1>
        <p class="mt-2 text-slate-600">
            Add one or more GitHub repositories and optionally associate them with an event
        </p>
    </div>

    <!-- Instructions -->
    <Card>
        <CardHeader>
            <div class="flex items-center gap-2">
                <GitBranch class="h-5 w-5 text-slate-500" />
                <h2 class="text-lg font-semibold">Instructions</h2>
            </div>
        </CardHeader>
        <CardContent>
            <div class="space-y-3 text-sm">
                <p>
                    Enter GitHub repository URLs below (one per line). Each repository will be
                    automatically fetched from GitHub and synced immediately.
                </p>
                <div class="rounded-md bg-slate-50 p-3">
                    <p class="font-medium mb-1">Example URLs:</p>
                    <code class="text-xs block">https://github.com/stellar/go</code>
                    <code class="text-xs block">https://github.com/ethereum/go-ethereum</code>
                    <code class="text-xs block">https://github.com/bitcoin/bitcoin</code>
                </div>
                <p class="text-slate-600">
                    Optionally, you can associate all repositories with an event. This is useful for
                    tracking repositories related to specific initiatives or milestones.
                </p>
            </div>
        </CardContent>
    </Card>

    <!-- Add Repository Form -->
    <Card>
        <CardHeader>
            <div class="flex items-center gap-2">
                <Plus class="h-5 w-5 text-slate-500" />
                <h2 class="text-lg font-semibold">Repository Details</h2>
            </div>
        </CardHeader>
        <CardContent>
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                }}
                class="space-y-4"
            >
                <!-- Repository URLs -->
                <div>
                    <label for="repo-urls" class="mb-2 block text-sm font-medium text-slate-700">
                        Repository URLs <span class="text-red-500">*</span>
                    </label>
                    <textarea
                        id="repo-urls"
                        bind:value={repoUrls}
                        rows={8}
                        placeholder="https://github.com/owner/repository&#10;https://github.com/owner/another-repo&#10;..."
                        required
                        class="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    ></textarea>
                    <p class="mt-1 text-xs text-slate-500">
                        {repoUrls.split("\n").filter((line) => line.trim()).length} repository URLs entered
                    </p>
                </div>

                <!-- Event Association -->
                <div>
                    <label for="event" class="mb-2 block text-sm font-medium text-slate-700">
                        Associate with Event (Optional)
                    </label>
                    {#if loadingEvents}
                        <div class="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            Loading events...
                        </div>
                    {:else if eventsError}
                        <ErrorAlert
                            message={eventsError}
                            retry={loadEvents}
                            class="mb-0"
                        />
                    {:else}
                        <select
                            id="event"
                            bind:value={selectedEventId}
                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                        >
                            <option value={null}>No event</option>
                            {#each events as event}
                                <option value={event.id}>
                                    {event.name}
                                    {#if event.startDate}
                                        - {new Date(event.startDate).toLocaleDateString()}
                                    {/if}
                                </option>
                            {/each}
                        </select>
                        <p class="mt-1 text-xs text-slate-500">
                            {events.length === 0
                                ? "No events available"
                                : "Select an event to associate this repository with"}
                        </p>
                    {/if}
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 pt-2">
                    <Button type="submit" disabled={loading || !repoUrls.trim()}>
                        {loading ? "Adding Repositories..." : "Add Repositories"}
                    </Button>
                    <Button
                        variant="outline"
                        type="button"
                        onclick={() => goto("/repositories")}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>

    <!-- Loading State -->
    {#if loading}
        <LoadingState message="Adding repositories and syncing commits..." />
    {/if}

    <!-- Error Alert -->
    {#if error}
        <ErrorAlert title="Failed to Add Repositories" message={error} />
    {/if}

    <!-- Results -->
    {#if result}
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    {#if result.failed === 0 && result.skipped === 0}
                        <CheckCircle class="h-5 w-5 text-green-600" />
                    {:else if result.success > 0}
                        <AlertCircle class="h-5 w-5 text-orange-600" />
                    {:else}
                        <XCircle class="h-5 w-5 text-red-600" />
                    {/if}
                    <h2 class="text-lg font-semibold">Results</h2>
                </div>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    <!-- Summary -->
                    <div class="grid grid-cols-3 gap-4">
                        <div class="rounded-md bg-green-50 p-4">
                            <div class="text-2xl font-bold text-green-700">
                                {result.success}
                            </div>
                            <div class="text-sm text-green-600">Successfully added</div>
                        </div>
                        <div
                            class="rounded-md p-4"
                            class:bg-orange-50={result.skipped > 0}
                            class:bg-slate-50={result.skipped === 0}
                        >
                            <div
                                class="text-2xl font-bold"
                                class:text-orange-700={result.skipped > 0}
                                class:text-slate-600={result.skipped === 0}
                            >
                                {result.skipped}
                            </div>
                            <div
                                class="text-sm"
                                class:text-orange-600={result.skipped > 0}
                                class:text-slate-500={result.skipped === 0}
                            >
                                Skipped (already exist)
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

                    <!-- Detailed Results -->
                    <div>
                        <h3 class="mb-2 font-semibold text-slate-900">Details:</h3>
                        <div class="space-y-2">
                            {#each result.results as item}
                                <div
                                    class="rounded-md border p-3 text-sm"
                                    class:border-green-200={item.status === "success"}
                                    class:bg-green-50={item.status === "success"}
                                    class:border-orange-200={item.status === "skipped"}
                                    class:bg-orange-50={item.status === "skipped"}
                                    class:border-red-200={item.status === "failed"}
                                    class:bg-red-50={item.status === "failed"}
                                >
                                    <div class="flex items-start justify-between">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                {#if item.status === "success"}
                                                    <CheckCircle class="h-4 w-4 text-green-600" />
                                                {:else if item.status === "skipped"}
                                                    <AlertCircle class="h-4 w-4 text-orange-600" />
                                                {:else}
                                                    <XCircle class="h-4 w-4 text-red-600" />
                                                {/if}
                                                <span
                                                    class="font-medium"
                                                    class:text-green-900={item.status === "success"}
                                                    class:text-orange-900={item.status === "skipped"}
                                                    class:text-red-900={item.status === "failed"}
                                                >
                                                    {item.url}
                                                </span>
                                            </div>
                                            {#if item.error}
                                                <p
                                                    class="mt-1"
                                                    class:text-orange-700={item.status === "skipped"}
                                                    class:text-red-700={item.status === "failed"}
                                                >
                                                    {item.error}
                                                </p>
                                            {/if}
                                        </div>
                                        {#if item.status === "success" && item.repositoryId}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onclick={() => goto(`/repositories/${item.repositoryId}`)}
                                            >
                                                View
                                            </Button>
                                        {/if}
                                        {#if item.status === "skipped" && item.repositoryId}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onclick={() => goto(`/repositories/${item.repositoryId}`)}
                                            >
                                                View
                                            </Button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-3">
                        <Button onclick={() => goto("/repositories")}>
                            View All Repositories
                        </Button>
                        <Button variant="outline" onclick={reset}>
                            Add More
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    {/if}
</div>
