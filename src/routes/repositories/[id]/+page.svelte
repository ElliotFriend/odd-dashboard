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
        GitCommitHorizontal,
        ArrowLeft,
        FolderTree,
        Plus,
        X,
        Trash2,
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

    interface Ecosystem {
        id: number;
        name: string;
        parentId: number | null;
        createdAt: string;
        updatedAt: string;
    }

    interface Event {
        id: number;
        name: string;
        description: string | null;
        startDate: string | null;
        endDate: string | null;
    }

    let repository = $state<Repository | null>(null);
    let commits = $state<Commit[]>([]);
    let contributors = $state<Contributor[]>([]);
    let authors = $state<Map<number, Author>>(new Map());
    let loading = $state(true);
    let syncing = $state(false);
    let deleting = $state(false);
    let error = $state<string | null>(null);

    // Ecosystem management
    let ecosystems = $state<Ecosystem[]>([]);
    let assignedEcosystems = $state<Ecosystem[]>([]);
    let showEcosystemPicker = $state(false);
    let loadingEcosystems = $state(false);

    // Event display
    let assignedEvents = $state<Event[]>([]);
    let loadingEvents = $state(false);

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
                `/api/repositories/${repositoryId}/contributors?${params.toString()}`,
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

    async function loadEcosystems() {
        try {
            loadingEcosystems = true;
            // Load all ecosystems
            const ecoResponse = await fetch('/api/ecosystems');
            if (ecoResponse.ok) {
                const ecoData = await ecoResponse.json();
                ecosystems = ecoData.data || [];
            }

            // Load assigned ecosystems for this repository
            const assignedResponse = await fetch(`/api/repositories/${repositoryId}/ecosystems`);
            if (assignedResponse.ok) {
                const assignedData = await assignedResponse.json();
                assignedEcosystems = assignedData.data || [];
            }
        } catch (err) {
            console.error('Error loading ecosystems:', err);
        } finally {
            loadingEcosystems = false;
        }
    }

    async function addEcosystem(ecosystemId: number) {
        try {
            const response = await fetch(`/api/repositories/${repositoryId}/ecosystems`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ecosystemId }),
            });

            if (!response.ok) {
                throw new Error('Failed to add ecosystem');
            }

            await loadEcosystems();
            showEcosystemPicker = false;
        } catch (err) {
            console.error('Error adding ecosystem:', err);
            error = 'Failed to add ecosystem';
        }
    }

    async function removeEcosystem(ecosystemId: number) {
        if (!confirm('Remove this ecosystem association?')) {
            return;
        }

        try {
            const response = await fetch(`/api/repositories/${repositoryId}/ecosystems`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ecosystemId }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove ecosystem');
            }

            await loadEcosystems();
        } catch (err) {
            console.error('Error removing ecosystem:', err);
            error = 'Failed to remove ecosystem';
        }
    }

    function getAvailableEcosystems(): Ecosystem[] {
        const assignedIds = new Set(assignedEcosystems.map((e) => e.id));
        return ecosystems.filter((e) => !assignedIds.has(e.id));
    }

    async function loadEvents() {
        try {
            loadingEvents = true;
            const response = await fetch(`/api/repositories/${repositoryId}/events`);
            if (response.ok) {
                const data = await response.json();
                assignedEvents = data.data || [];
            }
        } catch (err) {
            console.error('Error loading events:', err);
        } finally {
            loadingEvents = false;
        }
    }

    async function deleteRepositoryHandler() {
        if (!repository) return;

        const confirmed = confirm(
            `Are you sure you want to delete "${repository.fullName}"? This will permanently delete the repository and all its commits. This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            deleting = true;
            error = null;

            const response = await fetch(`/api/repositories/${repositoryId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete repository');
            }

            // Redirect to repositories list after successful deletion
            goto('/repositories');
        } catch (err: any) {
            error = err.message || 'Failed to delete repository';
            console.error('Error deleting repository:', err);
        } finally {
            deleting = false;
        }
    }

    onMount(async () => {
        await loadRepository();
        if (repository) {
            await Promise.all([loadCommits(), loadContributors(), loadEcosystems(), loadEvents()]);
        }
    });
</script>

<div class="space-y-6">
    <!-- Back Button -->
    <Button variant="outline" onclick={() => goto('/repositories')}>
        <ArrowLeft class="mr-2 h-4 w-4" />
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
                    <GitBranch class="h-6 w-6 text-slate-500" />
                    <h1 class="text-3xl font-bold text-slate-900">{repository.fullName}</h1>
                    {#if repository.isFork}
                        <span
                            class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
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
                    <span
                        >Default branch: <span class="font-medium">{repository.defaultBranch}</span
                        ></span
                    >
                    {#if repository.lastSyncedAt}
                        <span
                            >Last synced: <span class="font-medium"
                                >{formatDateTime(repository.lastSyncedAt)}</span
                            ></span
                        >
                    {:else}
                        <span class="text-slate-400">Never synced</span>
                    {/if}
                </div>
            </div>

            <div class="flex gap-2">
                <Button variant="outline" onclick={syncRepository} disabled={syncing || deleting}>
                    <RefreshCw class="mr-2 h-4 w-4 {syncing ? 'animate-spin' : ''}" />
                    {syncing ? 'Syncing...' : 'Sync Commits'}
                </Button>
                <a
                    href={`https://github.com/${repository.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Button variant="outline">
                        <ExternalLink class="mr-2 h-4 w-4" />
                        View on GitHub
                    </Button>
                </a>
                <Button
                    variant="outline"
                    onclick={deleteRepositoryHandler}
                    disabled={syncing || deleting}
                    class="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                    <Trash2 class="mr-2 h-4 w-4" />
                    {deleting ? 'Deleting...' : 'Delete'}
                </Button>
            </div>
        </div>

        <!-- Ecosystems -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <FolderTree class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Ecosystems</h2>
                    </div>
                    {#if !showEcosystemPicker}
                        <Button
                            size="sm"
                            onclick={() => (showEcosystemPicker = true)}
                            disabled={loadingEcosystems}
                        >
                            <Plus class="mr-2 h-4 w-4" />
                            Add Ecosystem
                        </Button>
                    {/if}
                </div>
            </CardHeader>
            <CardContent>
                {#if loadingEcosystems}
                    <div class="text-sm text-slate-500">Loading ecosystems...</div>
                {:else if showEcosystemPicker}
                    <div class="space-y-3">
                        <div>
                            <label for="ecosystem-select" class="mb-2 block text-sm font-medium">
                                Select an ecosystem
                            </label>
                            <select
                                id="ecosystem-select"
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                onchange={(e) => {
                                    const target = e.target as HTMLSelectElement;
                                    if (target.value) {
                                        addEcosystem(parseInt(target.value));
                                    }
                                }}
                            >
                                <option value="">Choose an ecosystem...</option>
                                {#each getAvailableEcosystems() as ecosystem}
                                    <option value={ecosystem.id}>{ecosystem.name}</option>
                                {/each}
                            </select>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => (showEcosystemPicker = false)}
                        >
                            Cancel
                        </Button>
                    </div>
                {:else if assignedEcosystems.length === 0}
                    <div class="text-center py-8">
                        <FolderTree class="mx-auto h-12 w-12 text-slate-400 mb-3" />
                        <p class="text-sm text-slate-500">No ecosystems assigned</p>
                        <Button
                            size="sm"
                            class="mt-3"
                            onclick={() => (showEcosystemPicker = true)}
                        >
                            <Plus class="mr-2 h-4 w-4" />
                            Add Ecosystem
                        </Button>
                    </div>
                {:else}
                    <div class="flex flex-wrap gap-2">
                        {#each assignedEcosystems as ecosystem}
                            <div
                                class="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm"
                            >
                                <FolderTree class="h-3 w-3 text-blue-600" />
                                <span class="text-blue-900">{ecosystem.name}</span>
                                <button
                                    onclick={() => removeEcosystem(ecosystem.id)}
                                    class="text-blue-600 hover:text-blue-800"
                                    title="Remove ecosystem"
                                >
                                    <X class="h-3 w-3" />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Events -->
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <Calendar class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Events</h2>
                </div>
            </CardHeader>
            <CardContent>
                {#if loadingEvents}
                    <div class="text-sm text-slate-500">Loading events...</div>
                {:else if assignedEvents.length === 0}
                    <div class="text-center py-6">
                        <Calendar class="mx-auto h-10 w-10 text-slate-400 mb-2" />
                        <p class="text-sm text-slate-500">Not associated with any events</p>
                        <p class="text-xs text-slate-400 mt-1">
                            Events can be managed from the event detail page
                        </p>
                    </div>
                {:else}
                    <div class="flex flex-wrap gap-2">
                        {#each assignedEvents as event}
                            <a
                                href={`/events/${event.id}`}
                                class="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-sm hover:bg-purple-100 transition-colors"
                            >
                                <Calendar class="h-3 w-3 text-purple-600" />
                                <span class="text-purple-900">{event.name}</span>
                            </a>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Date Range Filter -->
        <Card>
            <CardContent>
                <div class="mb-4 flex items-center gap-2">
                    <Calendar class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Date Range Filter</h2>
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label
                            for="start-date"
                            class="mb-1 block text-sm font-medium text-slate-700"
                        >
                            Start Date
                        </label>
                        <input
                            id="start-date"
                            type="date"
                            bind:value={startDate}
                            onchange={handleDateFilterChange}
                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
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
                            onchange={handleDateFilterChange}
                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Contributors -->
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <User class="h-5 w-5 text-slate-500" />
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
                                class="flex items-center justify-between rounded-md bg-slate-50 p-3"
                            >
                                <div>
                                    <p class="font-medium text-slate-900">
                                        {contributor.name ||
                                            contributor.username ||
                                            contributor.email}
                                    </p>
                                    {#if contributor.username}
                                        <p class="text-sm text-slate-600">
                                            @{contributor.username}
                                        </p>
                                    {/if}
                                </div>
                                <div class="flex items-center gap-2">
                                    <GitCommitHorizontal class="h-4 w-4 text-slate-500" />
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
                    <GitCommitHorizontal class="h-5 w-5 text-slate-500" />
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
                                class="flex items-center justify-between rounded-md bg-slate-50 p-3"
                            >
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <code
                                            class="rounded border bg-white px-2 py-1 font-mono text-sm text-slate-900"
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
                                <div class="ml-4 text-sm text-slate-500">
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
