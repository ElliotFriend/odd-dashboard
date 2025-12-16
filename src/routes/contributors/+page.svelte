<script lang="ts">
    import { onMount } from 'svelte';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import { Users, Calendar, GitCommitHorizontal, Funnel, TrendingUp } from '@lucide/svelte';
    import { formatDate } from '$lib/utils/date';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import ErrorAlert from '$lib/components/ErrorAlert.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
    import ContributorTrends from '$lib/components/charts/ContributorTrends.svelte';

    interface Contributor {
        id: number;
        githubId: number | null;
        username: string | null;
        name: string | null;
        email: string;
        commitCount: number;
    }

    interface Agency {
        id: number;
        name: string;
    }

    let contributors = $state<Contributor[]>([]);
    let agencies = $state<Agency[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // Date range filter
    let startDate = $state<string>('');
    let endDate = $state<string>('');
    let selectedAgencyId = $state<number | null>(null);

    async function loadAgencies() {
        try {
            const response = await fetch('/api/agencies');
            if (response.ok) {
                const data = await response.json();
                agencies = data.data || [];
            }
        } catch (err) {
            console.error('Error loading agencies:', err);
        }
    }

    async function loadContributors() {
        try {
            loading = true;
            error = null;

            if (!startDate || !endDate) {
                // Set default date range (last 30 days)
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 30);
                startDate = start.toISOString().split('T')[0];
                endDate = end.toISOString().split('T')[0];
            }

            const params = new URLSearchParams();
            params.set('startDate', startDate);
            params.set('endDate', endDate);
            if (selectedAgencyId) {
                params.set('agencyId', selectedAgencyId.toString());
            }

            const response = await fetch(`/api/contributors?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to load contributors');
            }

            const data = await response.json();
            contributors = data.data || [];
        } catch (err: any) {
            error = err.message || 'Failed to load contributors';
            console.error('Error loading contributors:', err);
        } finally {
            loading = false;
        }
    }

    function handleFilterChange() {
        loadContributors();
    }

    onMount(async () => {
        await loadAgencies();
        await loadContributors();
    });
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-3xl font-bold text-slate-900">Contributors</h1>
        <p class="mt-2 text-slate-600">View contributors and their commit activity</p>
    </div>

    <!-- Filters -->
    <Card>
        <CardContent>
            <div class="space-y-4">
                <div class="flex items-center gap-2">
                    <Funnel class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Filters</h2>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <!-- Start Date -->
                    <div>
                        <label
                            for="start-date"
                            class="mb-1 block text-sm font-medium text-slate-700"
                        >
                            Start Date *
                        </label>
                        <input
                            id="start-date"
                            type="date"
                            bind:value={startDate}
                            onchange={handleFilterChange}
                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                        />
                    </div>

                    <!-- End Date -->
                    <div>
                        <label for="end-date" class="mb-1 block text-sm font-medium text-slate-700">
                            End Date *
                        </label>
                        <input
                            id="end-date"
                            type="date"
                            bind:value={endDate}
                            onchange={handleFilterChange}
                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                        />
                    </div>

                    <!-- Agency Filter -->
                    <div>
                        <label for="agency" class="mb-1 block text-sm font-medium text-slate-700">
                            Agency
                        </label>
                        <select
                            id="agency"
                            bind:value={selectedAgencyId}
                            onchange={handleFilterChange}
                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                        >
                            <option value={null}>All Agencies</option>
                            {#each agencies as agency}
                                <option value={agency.id}>{agency.name}</option>
                            {/each}
                        </select>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>

    {#if loading}
        <LoadingState message="Loading contributors..." />
        <SkeletonLoader variant="card" count={3} height="200px" />
    {:else if error}
        <ErrorAlert
            title="Failed to load contributors"
            message={error}
            retry={loadContributors}
        />
    {:else if contributors.length === 0}
        <EmptyState
            title="No contributors found"
            description="Try adjusting your date range or filters to see contributor activity."
            icon={Users}
        />
    {:else}
        <!-- Contributors Chart -->
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <TrendingUp class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Top Contributors</h2>
                </div>
            </CardHeader>
            <CardContent>
                <ContributorTrends
                    contributors={contributors.map(c => ({
                        name: c.name || c.username || c.email,
                        commitCount: c.commitCount
                    }))}
                    title="Most Active Contributors"
                />
            </CardContent>
        </Card>

        <!-- Contributors List -->
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <Users class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">All Contributors</h2>
                    <span class="text-sm text-slate-500">({contributors.length})</span>
                </div>
            </CardHeader>
            <CardContent>
                {#if contributors.length > 0}
                    <div class="space-y-2">
                        {#each contributors as contributor}
                            <div
                                class="flex items-center justify-between rounded-md bg-slate-50 p-4 transition-colors hover:bg-slate-100"
                            >
                                <div class="flex-1">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-semibold text-slate-900">
                                            {contributor.name ||
                                                contributor.username ||
                                                contributor.email}
                                        </h3>
                                        {#if contributor.username}
                                            <span class="text-sm text-slate-500">
                                                @{contributor.username}
                                            </span>
                                        {/if}
                                    </div>
                                    {#if contributor.email && contributor.email !== (contributor.name || contributor.username)}
                                        <p class="mt-1 text-sm text-slate-600">
                                            {contributor.email}
                                        </p>
                                    {/if}
                                </div>
                                <div class="ml-4 flex items-center gap-2">
                                    <GitCommitHorizontal class="h-5 w-5 text-slate-500" />
                                    <span class="text-lg font-bold text-slate-900">
                                        {contributor.commitCount}
                                    </span>
                                    <span class="text-sm text-slate-500">
                                        commit{contributor.commitCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>
