<script lang="ts">
    import { onMount } from 'svelte';
    import { GitBranch, Users, GitCommit, TrendingUp } from '@lucide/svelte';
    import { formatDate } from '$lib/utils/date';

    interface Stats {
        repositories: number;
        authors: number;
        commits: number;
        recentActivity: Array<{
            type: string;
            message: string;
            timestamp: string;
        }>;
    }

    let stats = $state<Stats | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    async function loadStats() {
        try {
            loading = true;
            error = null;

            // Fetch stats from multiple endpoints
            const [reposRes, authorsRes] = await Promise.all([
                fetch('/api/repositories'),
                fetch('/api/authors'),
            ]);

            if (!reposRes.ok || !authorsRes.ok) {
                throw new Error('Failed to load statistics');
            }

            const reposData = await reposRes.json();
            const authorsData = await authorsRes.json();

            // Calculate total commits by fetching commits for each repository
            // For now, we'll use a placeholder (could be optimized with a count endpoint)
            let totalCommits = 0;
            const repos = reposData.data || [];
            if (repos.length > 0) {
                // Fetch commits for the first repository as a sample
                // In a real scenario, we'd want a count endpoint
                try {
                    const commitsRes = await fetch(`/api/commits?repositoryId=${repos[0].id}`);
                    if (commitsRes.ok) {
                        const commitsData = await commitsRes.json();
                        totalCommits = commitsData.data?.length || 0;
                    }
                } catch (err) {
                    // Ignore errors for commit count
                    console.warn('Could not fetch commit count:', err);
                }
            }

            stats = {
                repositories: repos.length,
                authors: authorsData.data?.length || 0,
                commits: totalCommits,
                recentActivity: [],
            };
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
        <div class="flex items-center justify-center py-12">
            <div class="text-slate-500">Loading...</div>
        </div>
    {:else if error}
        <div class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-800">{error}</div>
        </div>
    {:else if stats}
        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <!-- Repositories Card -->
            <div class="rounded-lg bg-white p-6 shadow-sm border border-slate-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-slate-600">Repositories</p>
                        <p class="mt-2 text-3xl font-bold text-slate-900">
                            {stats.repositories}
                        </p>
                    </div>
                    <div class="rounded-full bg-blue-100 p-3">
                        <GitBranch class="w-6 h-6 text-blue-600" />
                    </div>
                </div>
            </div>

            <!-- Authors Card -->
            <div class="rounded-lg bg-white p-6 shadow-sm border border-slate-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-slate-600">Contributors</p>
                        <p class="mt-2 text-3xl font-bold text-slate-900">{stats.authors}</p>
                    </div>
                    <div class="rounded-full bg-green-100 p-3">
                        <Users class="w-6 h-6 text-green-600" />
                    </div>
                </div>
            </div>

            <!-- Commits Card -->
            <div class="rounded-lg bg-white p-6 shadow-sm border border-slate-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-slate-600">Commits</p>
                        <p class="mt-2 text-3xl font-bold text-slate-900">{stats.commits}</p>
                    </div>
                    <div class="rounded-full bg-purple-100 p-3">
                        <GitCommit class="w-6 h-6 text-purple-600" />
                    </div>
                </div>
            </div>

            <!-- Activity Card -->
            <div class="rounded-lg bg-white p-6 shadow-sm border border-slate-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-slate-600">Activity</p>
                        <p class="mt-2 text-3xl font-bold text-slate-900">
                            {stats.recentActivity.length}
                        </p>
                    </div>
                    <div class="rounded-full bg-orange-100 p-3">
                        <TrendingUp class="w-6 h-6 text-orange-600" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Activity Section -->
        <div class="rounded-lg bg-white shadow-sm border border-slate-200">
            <div class="px-6 py-4 border-b border-slate-200">
                <h2 class="text-lg font-semibold text-slate-900">Recent Activity</h2>
            </div>
            <div class="p-6">
                {#if stats.recentActivity.length === 0}
                    <p class="text-sm text-slate-500">No recent activity to display</p>
                {:else}
                    <ul class="space-y-4">
                        {#each stats.recentActivity as activity}
                            <li class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-slate-900">
                                        {activity.message}
                                    </p>
                                    <p class="text-xs text-slate-500">
                                        {formatDate(activity.timestamp)}
                                    </p>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>
    {/if}
</div>
