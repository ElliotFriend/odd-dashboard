<script lang="ts">
    import { onMount } from "svelte";

    interface EcosystemStats {
        ecosystemId: string;
        name: string;
        parentId: string | null;
        totalRepositories: number;
        totalCommits: number;
        totalContributors: number;
    }

    interface Props {
        startDate?: Date;
        endDate?: Date;
    }

    let { startDate, endDate }: Props = $props();

    let statistics: EcosystemStats[] = $state([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    async function fetchStatistics() {
        loading = true;
        error = null;
        try {
            const params = new URLSearchParams();
            if (startDate) {
                params.append("startDate", startDate.toISOString());
            }
            if (endDate) {
                params.append("endDate", endDate.toISOString());
            }

            const response = await fetch(
                `/api/statistics/ecosystems?${params.toString()}`,
            );
            if (!response.ok) {
                throw new Error("Failed to fetch ecosystem statistics");
            }

            statistics = await response.json();
        } catch (err) {
            error =
                err instanceof Error
                    ? err.message
                    : "Failed to fetch statistics";
        } finally {
            loading = false;
        }
    }

    onMount(fetchStatistics);

    // Refetch when date range changes
    $effect(() => {
        if (startDate || endDate) {
            fetchStatistics();
        }
    });

    // Sort statistics by total commits (descending)
    let sortedStatistics = $derived(
        [...statistics].sort(
            (a, b) => b.totalCommits - a.totalCommits,
        ),
    );
</script>

<div class="space-y-4">
    <div>
        <h3 class="text-lg font-semibold">Ecosystem Statistics</h3>
        <p class="text-sm text-muted-foreground">
            Overview of activity across ecosystems
        </p>
    </div>

    {#if loading}
        <div class="space-y-2">
            {#each Array(5) as _}
                <div class="h-16 animate-pulse rounded-lg bg-muted"></div>
            {/each}
        </div>
    {:else if error}
        <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p class="text-sm text-destructive">{error}</p>
        </div>
    {:else if sortedStatistics.length === 0}
        <div class="rounded-lg border border-dashed p-8 text-center">
            <p class="text-sm text-muted-foreground">No ecosystem data available</p>
        </div>
    {:else}
        <div class="overflow-x-auto rounded-lg border">
            <table class="w-full">
                <thead class="bg-muted/50">
                    <tr class="border-b">
                        <th class="px-4 py-3 text-left text-sm font-medium">Ecosystem</th>
                        <th class="px-4 py-3 text-right text-sm font-medium">Repositories</th>
                        <th class="px-4 py-3 text-right text-sm font-medium">Commits</th>
                        <th class="px-4 py-3 text-right text-sm font-medium">Contributors</th>
                    </tr>
                </thead>
                <tbody>
                    {#each sortedStatistics as stat (stat.ecosystemId)}
                        <tr class="border-b last:border-b-0 hover:bg-muted/50">
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-2">
                                    <span class="font-medium">{stat.name}</span>
                                    {#if stat.parentId}
                                        <span class="text-xs text-muted-foreground">(child)</span>
                                    {/if}
                                </div>
                            </td>
                            <td class="px-4 py-3 text-right tabular-nums">
                                {stat.totalRepositories.toLocaleString()}
                            </td>
                            <td class="px-4 py-3 text-right tabular-nums font-medium">
                                {stat.totalCommits.toLocaleString()}
                            </td>
                            <td class="px-4 py-3 text-right tabular-nums">
                                {stat.totalContributors.toLocaleString()}
                            </td>
                        </tr>
                    {/each}
                </tbody>
                <tfoot class="border-t bg-muted/30">
                    <tr>
                        <td class="px-4 py-3 font-medium">Total</td>
                        <td class="px-4 py-3 text-right font-medium tabular-nums">
                            {sortedStatistics
                                .reduce((sum, s) => sum + s.totalRepositories, 0)
                                .toLocaleString()}
                        </td>
                        <td class="px-4 py-3 text-right font-medium tabular-nums">
                            {sortedStatistics
                                .reduce((sum, s) => sum + s.totalCommits, 0)
                                .toLocaleString()}
                        </td>
                        <td class="px-4 py-3 text-right font-medium tabular-nums">
                            {sortedStatistics
                                .reduce((sum, s) => sum + s.totalContributors, 0)
                                .toLocaleString()}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    {/if}
</div>
