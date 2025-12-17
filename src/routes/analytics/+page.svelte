<script lang="ts">
    import { onMount } from 'svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import Button from '$lib/components/ui/button.svelte';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import ErrorAlert from '$lib/components/ErrorAlert.svelte';
    import { TrendingUp, GitCommit, Users, FolderGit2 } from '@lucide/svelte';

    interface TopAuthorByCommits {
        authorId: number;
        name: string;
        email: string;
        commitCount: number;
    }

    interface TopAuthorByRepos {
        authorId: number;
        name: string;
        email: string;
        repoCount: number;
    }

    interface TopRepoByCommits {
        repositoryId: number;
        fullName: string;
        commitCount: number;
    }

    interface TopRepoByAuthors {
        repositoryId: number;
        fullName: string;
        authorCount: number;
    }

    interface AnalyticsData {
        dateRange: {
            startDate: string;
            endDate: string;
        };
        topAuthorsByCommits: TopAuthorByCommits[];
        topAuthorsByRepos: TopAuthorByRepos[];
        topReposByCommits: TopRepoByCommits[];
        topReposByAuthors: TopRepoByAuthors[];
    }

    let loading = $state(true);
    let error = $state<string | null>(null);
    let analytics = $state<AnalyticsData | null>(null);

    // Date range state - default to last 30 days
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let startDate = $state(thirtyDaysAgo);
    let endDate = $state(today);
    let limit = $state(25); // Default to top 25

    const limitOptions = [10, 25, 50, 100];

    async function loadAnalytics() {
        try {
            loading = true;
            error = null;

            const params = new URLSearchParams({
                startDate,
                endDate,
                limit: limit.toString()
            });

            const response = await fetch(`/api/analytics?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to load analytics');
            }

            analytics = await response.json();
        } catch (err: any) {
            error = err.message || 'Failed to load analytics';
            console.error('Error loading analytics:', err);
        } finally {
            loading = false;
        }
    }

    function handleDateChange() {
        loadAnalytics();
    }

    function handleLimitChange() {
        loadAnalytics();
    }

    onMount(() => {
        loadAnalytics();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-slate-900">Analytics</h1>
            <p class="mt-2 text-slate-600">Top contributors and repositories by activity</p>
        </div>
    </div>

    <!-- Date Range Selector -->
    <Card>
        <CardContent>
            <div class="flex flex-wrap items-end gap-4">
                <div>
                    <label for="start-date" class="mb-1 block text-sm font-medium text-slate-700">
                        Start Date
                    </label>
                    <input
                        id="start-date"
                        type="date"
                        bind:value={startDate}
                        onchange={handleDateChange}
                        max={endDate}
                        class="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                </div>
                <div>
                    <label for="end-date" class="mb-1 block text-sm font-medium text-slate-700">
                        End Date
                    </label>
                    <input
                        id="end-date"
                        type="date"
                        bind:value={endDate}
                        onchange={handleDateChange}
                        min={startDate}
                        max={today}
                        class="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                </div>
                <div>
                    <label for="limit" class="mb-1 block text-sm font-medium text-slate-700">
                        Top
                    </label>
                    <select
                        id="limit"
                        bind:value={limit}
                        onchange={handleLimitChange}
                        class="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                        {#each limitOptions as option (option)}
                            <option value={option}>{option}</option>
                        {/each}
                    </select>
                </div>
                <Button onclick={loadAnalytics} variant="outline">
                    <TrendingUp class="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>
        </CardContent>
    </Card>

    {#if loading}
        <LoadingState message="Loading analytics..." />
    {:else if error}
        <ErrorAlert title="Failed to load analytics" message={error} retry={loadAnalytics} />
    {:else if analytics}
        <div class="grid gap-6 md:grid-cols-2">
            <!-- Top Authors by Commits -->
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-2">
                        <GitCommit class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Top Authors by Commits</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    {#if analytics.topAuthorsByCommits.length === 0}
                        <p class="py-8 text-center text-slate-500">No data for this period</p>
                    {:else}
                        <div class="space-y-3">
                            {#each analytics.topAuthorsByCommits as author, index (author.authorId)}
                                <div class="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                                    <div class="flex items-center gap-3">
                                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p class="font-medium text-slate-900">{author.name}</p>
                                            <p class="text-xs text-slate-500">{author.email}</p>
                                        </div>
                                    </div>
                                    <span class="text-lg font-semibold text-slate-900">
                                        {author.commitCount.toLocaleString()}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </CardContent>
            </Card>

            <!-- Top Authors by Repos -->
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-2">
                        <FolderGit2 class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Top Authors by Repositories</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    {#if analytics.topAuthorsByRepos.length === 0}
                        <p class="py-8 text-center text-slate-500">No data for this period</p>
                    {:else}
                        <div class="space-y-3">
                            {#each analytics.topAuthorsByRepos as author, index (author.authorId)}
                                <div class="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                                    <div class="flex items-center gap-3">
                                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p class="font-medium text-slate-900">{author.name}</p>
                                            <p class="text-xs text-slate-500">{author.email}</p>
                                        </div>
                                    </div>
                                    <span class="text-lg font-semibold text-slate-900">
                                        {author.repoCount} {author.repoCount === 1 ? 'repo' : 'repos'}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </CardContent>
            </Card>

            <!-- Top Repos by Commits -->
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-2">
                        <GitCommit class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Top Repositories by Commits</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    {#if analytics.topReposByCommits.length === 0}
                        <p class="py-8 text-center text-slate-500">No data for this period</p>
                    {:else}
                        <div class="space-y-3">
                            {#each analytics.topReposByCommits as repo, index (repo.repositoryId)}
                                <div class="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                                    <div class="flex items-center gap-3">
                                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                            {index + 1}
                                        </span>
                                        <a
                                            href="/repositories/{repo.repositoryId}"
                                            class="font-medium text-slate-900 hover:text-slate-600"
                                        >
                                            {repo.fullName}
                                        </a>
                                    </div>
                                    <span class="text-lg font-semibold text-slate-900">
                                        {repo.commitCount.toLocaleString()}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </CardContent>
            </Card>

            <!-- Top Repos by Authors -->
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-2">
                        <Users class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Top Repositories by Contributors</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    {#if analytics.topReposByAuthors.length === 0}
                        <p class="py-8 text-center text-slate-500">No data for this period</p>
                    {:else}
                        <div class="space-y-3">
                            {#each analytics.topReposByAuthors as repo, index (repo.repositoryId)}
                                <div class="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                                    <div class="flex items-center gap-3">
                                        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                            {index + 1}
                                        </span>
                                        <a
                                            href="/repositories/{repo.repositoryId}"
                                            class="font-medium text-slate-900 hover:text-slate-600"
                                        >
                                            {repo.fullName}
                                        </a>
                                    </div>
                                    <span class="text-lg font-semibold text-slate-900">
                                        {repo.authorCount} {repo.authorCount === 1 ? 'contributor' : 'contributors'}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </CardContent>
            </Card>
        </div>
    {/if}
</div>
