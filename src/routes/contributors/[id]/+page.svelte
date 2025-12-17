<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import Card from '$lib/components/ui/card.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import Button from '$lib/components/ui/button.svelte';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import ErrorAlert from '$lib/components/ErrorAlert.svelte';
    import { User, GitCommit, FolderGit2, Calendar, TrendingUp } from '@lucide/svelte';

    interface AuthorRepositoryContribution {
        repositoryId: number;
        fullName: string;
        commitCount: number;
    }

    interface AuthorDetails {
        author: {
            id: number;
            githubId: number | null;
            username: string | null;
            name: string | null;
            email: string | null;
            agencyId: number | null;
        };
        statistics: {
            totalCommits: number;
            totalRepositories: number;
            dateRange: {
                startDate: string;
                endDate: string;
            };
        };
        repositories: AuthorRepositoryContribution[];
    }

    let loading = $state(true);
    let error = $state<string | null>(null);
    let authorDetails = $state<AuthorDetails | null>(null);

    // Date range state - default to last 30 days
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let startDate = $state(thirtyDaysAgo);
    let endDate = $state(today);

    const authorId = $derived(parseInt(page.params.id, 10));

    async function loadAuthorDetails() {
        try {
            loading = true;
            error = null;

            const params = new URLSearchParams({
                startDate,
                endDate,
            });

            const response = await fetch(`/api/contributors/${authorId}?${params.toString()}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Author not found');
                }
                throw new Error('Failed to load author details');
            }

            authorDetails = await response.json();
        } catch (err: any) {
            error = err.message || 'Failed to load author details';
            console.error('Error loading author details:', err);
        } finally {
            loading = false;
        }
    }

    function handleDateChange() {
        loadAuthorDetails();
    }

    onMount(() => {
        loadAuthorDetails();
    });
</script>

<div class="space-y-6">
    {#if loading}
        <LoadingState message="Loading author details..." />
    {:else if error}
        <ErrorAlert title="Failed to load author details" message={error} retry={loadAuthorDetails} />
    {:else if authorDetails}
        <!-- Header -->
        <div class="flex items-start justify-between">
            <div>
                <div class="flex items-center gap-3">
                    <User class="h-8 w-8 text-slate-500" />
                    <h1 class="text-3xl font-bold text-slate-900">
                        {authorDetails.author.name || authorDetails.author.username || authorDetails.author.email}
                    </h1>
                </div>
                <div class="mt-2 space-y-1">
                    {#if authorDetails.author.username}
                        <p class="text-slate-600">@{authorDetails.author.username}</p>
                    {/if}
                    {#if authorDetails.author.email && authorDetails.author.email !== authorDetails.author.name}
                        <p class="text-slate-600">{authorDetails.author.email}</p>
                    {/if}
                </div>
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
                    <Button onclick={loadAuthorDetails} variant="outline">
                        <TrendingUp class="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- Statistics Cards -->
        <div class="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <div class="flex items-center gap-2">
                        <GitCommit class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Total Commits</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    <p class="text-4xl font-bold text-slate-900">
                        {authorDetails.statistics.totalCommits.toLocaleString()}
                    </p>
                    <p class="mt-2 text-sm text-slate-600">
                        In the selected date range
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div class="flex items-center gap-2">
                        <FolderGit2 class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Repositories</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    <p class="text-4xl font-bold text-slate-900">
                        {authorDetails.statistics.totalRepositories}
                    </p>
                    <p class="mt-2 text-sm text-slate-600">
                        Contributed to
                    </p>
                </CardContent>
            </Card>
        </div>

        <!-- Repositories List -->
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <FolderGit2 class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Repository Contributions</h2>
                </div>
            </CardHeader>
            <CardContent>
                {#if authorDetails.repositories.length === 0}
                    <p class="py-8 text-center text-slate-500">
                        No repository contributions in this period
                    </p>
                {:else}
                    <div class="space-y-3">
                        {#each authorDetails.repositories as repo (repo.repositoryId)}
                            <div class="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0">
                                <a
                                    href="/repositories/{repo.repositoryId}"
                                    class="font-medium text-slate-900 hover:text-slate-600"
                                >
                                    {repo.fullName}
                                </a>
                                <span class="text-lg font-semibold text-slate-900">
                                    {repo.commitCount.toLocaleString()} commit{repo.commitCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>
