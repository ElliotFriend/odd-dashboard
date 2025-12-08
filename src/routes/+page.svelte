<script lang="ts">
    import { onMount } from 'svelte';
    import { GitBranch, Users, GitCommit, Package, Calendar, Building } from '@lucide/svelte';
    import { formatDate } from '$lib/utils/date';
    import ContributionChart from '$lib/components/charts/ContributionChart.svelte';
    import ActivityTimeline from '$lib/components/charts/ActivityTimeline.svelte';
    import StatisticsCard from '$lib/components/StatisticsCard.svelte';
    import EcosystemStatistics from '$lib/components/EcosystemStatistics.svelte';
    import EventStatistics from '$lib/components/EventStatistics.svelte';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import ErrorAlert from '$lib/components/ErrorAlert.svelte';
    import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';

    interface DashboardStats {
        totalRepositories: number;
        totalAuthors: number;
        totalCommits: number;
        totalEcosystems: number;
        totalEvents: number;
        totalAgencies: number;
    }

    // Chart data (placeholder - would be fetched from API in real implementation)
    let contributionData = $state<Array<{ date: string; commits: number }>>([]);
    let activityData = $state<Array<{ date: string; commits: number; contributors: number }>>([]);

    let stats = $state<DashboardStats | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    async function loadStats() {
        try {
            loading = true;
            error = null;

            // Fetch stats from the new statistics API
            const response = await fetch('/api/statistics/dashboard');
            if (!response.ok) {
                throw new Error('Failed to load statistics');
            }

            stats = await response.json();

            // Generate sample chart data (in real implementation, this would come from API)
            // For now, generate last 7 days of data
            const today = new Date();
            contributionData = [];
            activityData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                // Sample data - would be replaced with real API data
                contributionData.push({
                    date: dateStr,
                    commits: Math.floor(Math.random() * 20),
                });
                activityData.push({
                    date: dateStr,
                    commits: Math.floor(Math.random() * 20),
                    contributors: Math.floor(Math.random() * 10),
                });
            }
        } catch (err: any) {
            error = err.message || 'Failed to load dashboard statistics';
            console.error('Error loading stats:', err);
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        loadStats();
    });
</script>

<div class="space-y-8">
    <div>
        <h1 class="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p class="mt-2 text-slate-600">Overview of your GitHub contribution data</p>
    </div>

    {#if loading}
        <LoadingState message="Loading dashboard statistics..." />
        <div class="space-y-6 mt-8">
            <SkeletonLoader variant="card" count={6} height="120px" />
        </div>
    {:else if error}
        <ErrorAlert
            title="Failed to load dashboard"
            message={error}
            retry={loadStats}
        />
    {:else if stats}
        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <StatisticsCard
                title="Repositories"
                value={stats.totalRepositories}
                description="Total repositories tracked"
                icon={GitBranch}
            />

            <StatisticsCard
                title="Contributors"
                value={stats.totalAuthors}
                description="Unique contributors"
                icon={Users}
            />

            <StatisticsCard
                title="Commits"
                value={stats.totalCommits}
                description="Total commits recorded"
                icon={GitCommit}
            />

            <StatisticsCard
                title="Ecosystems"
                value={stats.totalEcosystems}
                description="Tracked ecosystems"
                icon={Package}
            />

            <StatisticsCard
                title="Events"
                value={stats.totalEvents}
                description="Tracked events"
                icon={Calendar}
            />

            <StatisticsCard
                title="Agencies"
                value={stats.totalAgencies}
                description="Tracked agencies"
                icon={Building}
            />
        </div>

        <!-- Charts Section -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <ContributionChart data={contributionData} />
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <ActivityTimeline data={activityData} />
            </div>
        </div>

        <!-- Ecosystem Statistics -->
        <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <EcosystemStatistics />
        </div>

        <!-- Event Statistics -->
        <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <EventStatistics />
        </div>
    {/if}
</div>
