<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import {
        GitBranch,
        ExternalLink,
        RefreshCw,
        Calendar,
        User,
        GitCommit,
        ArrowLeft,
    } from '@lucide/svelte';
    import { formatDate, formatDateTime } from '$lib/utils/date';

    interface Repository {
        id: number;
        githubId: number;
        fullName: string;
        agencyId: number | null;
        isFork: boolean;
        parentRepositoryId: number | null;
        parentFullName: string | null;
        defaultBranch: string;
        createdAt: string;
        updatedAt: string;
        lastSyncedAt: string | null;
    }

    interface Commit {
        id: number;
        repositoryId: number;
        authorId: number;
        sha: string;
        commitDate: string;
        branch: string;
    }

    interface Contributor {
        authorId: number;
        githubId: number | null;
        username: string | null;
        name: string | null;
        email: string;
        commitCount: number;
    }

    interface Author {
        id: number;
        githubId: number | null;
        username: string | null;
        name: string | null;
        email: string;
    }

    let repository: Repository | null = null;
    let commits: Commit[] = [];
    let contributors: Contributor[] = [];
    let authors: Map<number, Author> = new Map();
    let loading = true;
    let syncing = false;
    let error: string | null = null;

    // Date range filter
    let startDate = $state<string>('');
    let endDate = $state<string>('');

    const repositoryId = parseInt(page.params.id || '0', 10);

    async function loadRepository() {
        try {
            loading = true;
            error = null;

            const response = await fetch(`/api/repositories/${repositoryId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Repository not found');
                }
                throw new Error('Failed to load repository');
            }

            const data = await response.json();
            repository = data.data;
        } catch (err: any) {
            error = err.message || 'Failed to load repository';
            console.error('Error loading repository:', err);
        } finally {
            loading = false;
        }
    }

    async function loadCommits() {
        if (!repository) return;

        try {
            const params = new URLSearchParams();
            params.set('repositoryId', repository.id.toString());
            if (startDate) {
                params.set('startDate', startDate);
            }
            if (endDate) {
                params.set('endDate', endDate);
            }

            const response = await fetch(`/api/commits?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                commits = data.data || [];

                // Load author details for commits
                const authorIds = [...new Set(commits.map((c) => c.authorId))];
                await loadAuthors(authorIds);
            }
        } catch (err) {
            console.error('Error loading commits:', err);
        }
    }

    async function loadAuthors(authorIds: number[]) {
        try {
            // Load all authors at once by fetching the authors endpoint
            // and filtering client-side (API doesn't support filtering by multiple IDs yet)
            const response = await fetch('/api/authors');
            if (response.ok) {
                const data = await response.json();
                const allAuthors = data.data || [];
                authorIds.forEach((authorId) => {
                    const author = allAuthors.find((a: Author) => a.id === authorId);
                    if (author) {
                        authors.set(authorId, author);
                    }
                });
            }
        } catch (err) {
            console.error('Error loading authors:', err);
        }
    }

    async function loadContributors() {
        if (!repository) return;

        try {
            const params = new URLSearchParams();
            if (startDate) {
                params.set('startDate', startDate);
            }
            if (endDate) {
                params.set('endDate', endDate);
            }

            const response = await fetch(
                `/api/repositories/${repositoryId}/contributors?${params.toString()}`
            );
            if (response.ok) {
                const data = await response.json();
                contributors = data.data || [];
            }
        } catch (err) {
            console.error('Error loading contributors:', err);
        }
    }

    async function syncRepository() {
        if (!repository) return;

        try {
            syncing = true;
            error = null;

            const response = await fetch(`/api/repositories/${repositoryId}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initialSync: false }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to sync repository');
            }

            // Reload repository and commits after sync
            await loadRepository();
            await loadCommits();
            await loadContributors();
        } catch (err: any) {
            error = err.message || 'Failed to sync repository';
            console.error('Error syncing repository:', err);
        } finally {
            syncing = false;
        }
    }

    function handleDateFilterChange() {
        loadCommits();
        loadContributors();
    }

    onMount(async () => {
        await loadRepository();
        if (repository) {
            await Promise.all([loadCommits(), loadContributors()]);
        }
    });
</script>

<div class="space-y-6">
    <!-- Back Button -->
    <Button variant="outline" on:click={() => goto('/repositories')}>
        <ArrowLeft class="w-4 h-4 mr-2" />
        Back to Repositories
    </Button>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <div class="text-slate-500">Loading repository...</div>
        </div>
    {:else if error}
        <div class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-800">{error}</div>
        </div>
    {:else if repository}
        <!-- Repository Header -->
        <div class="flex items-start justify-between">
            <div>
                <div class="flex items-center gap-2">
                    <GitBranch class="w-6 h-6 text-slate-500" />
                    <h1 class="text-3xl font-bold text-slate-900">{repository.fullName}</h1>
                    {#if repository.isFork}
                        <span
                            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                            Fork
                        </span>
                    {/if}
                </div>

                {#if repository.parentFullName}
                    <p class="mt-1 text-slate-600">
                        Fork of
                        <a
                            href={`https://github.com/${repository.parentFullName}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="font-medium text-blue-600 hover:underline"
                        >
                            {repository.parentFullName}
                        </a>
                    </p>
                {/if}

                <div class="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>Default branch: <span class="font-medium">{repository.defaultBranch}</span></span>
                    {#if repository.lastSyncedAt}
                        <span>Last synced: <span class="font-medium">{formatDateTime(repository.lastSyncedAt)}</span></span>
                    {:else}
                        <span class="text-slate-400">Never synced</span>
                    {/if}
                </div>
            </div>

            <div class="flex gap-2">
                <Button
                    variant="outline"
                    on:click={syncRepository}
                    disabled={syncing}
                >
                    <RefreshCw class="w-4 h-4 mr-2 {syncing ? 'animate-spin' : ''}" />
                    {syncing ? 'Syncing...' : 'Sync Commits'}
                </Button>
                <a
                    href={`https://github.com/${repository.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Button variant="outline">
                        <ExternalLink class="w-4 h-4 mr-2" />
                        View on GitHub
                    </Button>
                </a>
            </div>
        </div>

        <!-- Date Range Filter -->
        <Card>
            <CardContent>
                <div class="flex items-center gap-2 mb-4">
                    <Calendar class="w-5 h-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Date Range Filter</h2>
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label
                            for="start-date"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Start Date
                        </label>
                        <input
                            id="start-date"
                            type="date"
                            bind:value={startDate}
                            on:change={handleDateFilterChange}
                            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                    </div>
                    <div>
                        <label
                            for="end-date"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            End Date
                        </label>
                        <input
                            id="end-date"
                            type="date"
                            bind:value={endDate}
                            on:change={handleDateFilterChange}
                            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Contributors -->
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <User class="w-5 h-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Contributors</h2>
                    <span class="text-sm text-slate-500">({contributors.length})</span>
                </div>
            </CardHeader>
            <CardContent>
                {#if contributors.length === 0}
                    <p class="text-sm text-slate-500">No contributors found</p>
                {:else}
                    <div class="space-y-2">
                        {#each contributors as contributor}
                            <div
                                class="flex items-center justify-between p-3 rounded-md bg-slate-50"
                            >
                                <div>
                                    <p class="font-medium text-slate-900">
                                        {contributor.name || contributor.username || contributor.email}
                                    </p>
                                    {#if contributor.username}
                                        <p class="text-sm text-slate-600">@{contributor.username}</p>
                                    {/if}
                                </div>
                                <div class="flex items-center gap-2">
                                    <GitCommit class="w-4 h-4 text-slate-500" />
                                    <span class="font-medium text-slate-900">
                                        {contributor.commitCount}
                                    </span>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Commits -->
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <GitCommit class="w-5 h-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Commits</h2>
                    <span class="text-sm text-slate-500">({commits.length})</span>
                </div>
            </CardHeader>
            <CardContent>
                {#if commits.length === 0}
                    <p class="text-sm text-slate-500">No commits found</p>
                {:else}
                    <div class="space-y-2">
                        {#each commits as commit}
                            {@const author = authors.get(commit.authorId)}
                            <div
                                class="flex items-center justify-between p-3 rounded-md bg-slate-50"
                            >
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <code
                                            class="text-sm font-mono text-slate-900 bg-white px-2 py-1 rounded border"
                                        >
                                            {commit.sha.substring(0, 7)}
                                        </code>
                                        <a
                                            href={`https://github.com/${repository.fullName}/commit/${commit.sha}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="text-blue-600 hover:underline"
                                        >
                                            View on GitHub
                                        </a>
                                    </div>
                                    {#if author}
                                        <p class="mt-1 text-sm text-slate-600">
                                            {author.name || author.username || author.email}
                                        </p>
                                    {/if}
                                </div>
                                <div class="text-sm text-slate-500 ml-4">
                                    {formatDateTime(commit.commitDate)}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>

