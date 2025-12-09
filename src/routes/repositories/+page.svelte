<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import { GitBranch, Search, Filter, ExternalLink, Package, Upload, Plus, RefreshCw } from '@lucide/svelte';
    import { formatDate } from '$lib/utils/date';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import ErrorAlert from '$lib/components/ErrorAlert.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';

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
        commitCount: number;
        contributorCount: number;
        lastCommitDate: string | null;
    }

    interface Agency {
        id: number;
        name: string;
    }

    interface Event {
        id: number;
        name: string;
    }

    let repositories = $state<Repository[]>([]);
    let agencies = $state<Agency[]>([]);
    let events = $state<Event[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // Filters
    let searchQuery = $state('');
    let selectedAgencyId = $state<number | null>(null);
    let selectedEventId = $state<number | null>(null);
    let excludeForksOnly = $state(false);

    // Sorting
    let sortBy = $state<'commits' | 'contributors' | 'lastCommitDate' | 'fullName'>('fullName');
    let sortOrder = $state<'asc' | 'desc'>('asc');

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

    async function loadEvents() {
        try {
            const response = await fetch('/api/events');
            if (response.ok) {
                const data = await response.json();
                events = data.data || [];
            }
        } catch (err) {
            console.error('Error loading events:', err);
        }
    }

    async function loadRepositories() {
        try {
            loading = true;
            error = null;

            const params = new URLSearchParams();
            if (searchQuery) {
                params.set('search', searchQuery);
            }
            if (selectedAgencyId) {
                params.set('agencyId', selectedAgencyId.toString());
            }
            if (selectedEventId) {
                params.set('eventId', selectedEventId.toString());
            }
            if (excludeForksOnly) {
                params.set('excludeForks', 'true');
            }
            if (sortBy) {
                params.set('sortBy', sortBy);
            }
            if (sortOrder) {
                params.set('sortOrder', sortOrder);
            }

            const response = await fetch(`/api/repositories?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Failed to load repositories');
            }

            const data = await response.json();
            repositories = data.data || [];
        } catch (err: any) {
            error = err.message || 'Failed to load repositories';
            console.error('Error loading repositories:', err);
        } finally {
            loading = false;
        }
    }

    function handleFilterChange() {
        loadRepositories();
    }

    function handleSortChange(field: typeof sortBy) {
        if (sortBy === field) {
            // Toggle sort order if same field
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            // Set new field and default to desc for numeric fields
            sortBy = field;
            sortOrder = field === 'fullName' ? 'asc' : 'desc';
        }
        loadRepositories();
    }

    function getAgencyName(agencyId: number | null): string {
        if (!agencyId) return 'No agency';
        const agency = agencies.find((a) => a.id === agencyId);
        return agency?.name || 'Unknown';
    }

    function getEventName(eventId: number | null): string {
        if (!eventId) return 'No event';
        const event = events.find((e) => e.id === eventId);
        return event?.name || 'Unknown';
    }

    onMount(() => {
        loadAgencies();
        loadEvents();
        loadRepositories();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-slate-900">Repositories</h1>
            <p class="mt-2 text-slate-600">Browse and manage GitHub repositories</p>
        </div>
        <div class="flex gap-3">
            <Button onclick={() => goto('/repositories/add')}>
                <Plus class="mr-2 h-4 w-4" />
                Add Repository
            </Button>
            <Button variant="outline" onclick={() => goto('/repositories/sync')}>
                <RefreshCw class="mr-2 h-4 w-4" />
                Batch Sync
            </Button>
            <Button variant="outline" onclick={() => goto('/repositories/bulk-import')}>
                <Upload class="mr-2 h-4 w-4" />
                Bulk Import
            </Button>
        </div>
    </div>

    <!-- Filters -->
    <Card>
        <CardContent>
            <div class="space-y-4">
                <div class="flex items-center gap-2">
                    <Filter class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Filters</h2>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <!-- Search -->
                    <div>
                        <label for="search" class="mb-1 block text-sm font-medium text-slate-700">
                            Search
                        </label>
                        <div class="relative">
                            <Search
                                class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400"
                            />
                            <input
                                id="search"
                                type="text"
                                bind:value={searchQuery}
                                oninput={handleFilterChange}
                                placeholder="Search repositories..."
                                class="w-full rounded-md border border-slate-300 py-2 pr-3 pl-10 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                            />
                        </div>
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

                    <!-- Event Filter -->
                    <div>
                        <label for="event" class="mb-1 block text-sm font-medium text-slate-700">
                            Event
                        </label>
                        <select
                            id="event"
                            bind:value={selectedEventId}
                            onchange={handleFilterChange}
                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                        >
                            <option value={null}>All Events</option>
                            {#each events as event}
                                <option value={event.id}>{event.name}</option>
                            {/each}
                        </select>
                    </div>

                    <!-- Exclude Forks Filter -->
                    <div class="flex items-end">
                        <label class="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                bind:checked={excludeForksOnly}
                                onchange={handleFilterChange}
                                class="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                            />
                            <span class="text-sm font-medium text-slate-700">Non-forks only</span>
                        </label>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>

    {#if loading}
        <LoadingState message="Loading repositories..." />
        <SkeletonLoader variant="card" count={5} height="150px" />
    {:else if error}
        <ErrorAlert
            title="Failed to load repositories"
            message={error}
            retry={loadRepositories}
        />
    {:else if repositories.length === 0}
        <EmptyState
            title="No repositories found"
            description="Try adjusting your filters or add a new repository to get started."
            icon={Package}
        />
    {:else}
        <!-- Sorting Controls -->
        <Card>
            <CardContent>
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-slate-700">Sort by:</span>
                    <div class="flex gap-2">
                        <button
                            onclick={() => handleSortChange('fullName')}
                            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                            class:bg-slate-900={sortBy === 'fullName'}
                            class:text-white={sortBy === 'fullName'}
                            class:bg-slate-100={sortBy !== 'fullName'}
                            class:text-slate-700={sortBy !== 'fullName'}
                        >
                            Name {sortBy === 'fullName' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </button>
                        <button
                            onclick={() => handleSortChange('commits')}
                            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                            class:bg-slate-900={sortBy === 'commits'}
                            class:text-white={sortBy === 'commits'}
                            class:bg-slate-100={sortBy !== 'commits'}
                            class:text-slate-700={sortBy !== 'commits'}
                        >
                            Commits {sortBy === 'commits' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </button>
                        <button
                            onclick={() => handleSortChange('contributors')}
                            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                            class:bg-slate-900={sortBy === 'contributors'}
                            class:text-white={sortBy === 'contributors'}
                            class:bg-slate-100={sortBy !== 'contributors'}
                            class:text-slate-700={sortBy !== 'contributors'}
                        >
                            Contributors {sortBy === 'contributors' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </button>
                        <button
                            onclick={() => handleSortChange('lastCommitDate')}
                            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                            class:bg-slate-900={sortBy === 'lastCommitDate'}
                            class:text-white={sortBy === 'lastCommitDate'}
                            class:bg-slate-100={sortBy !== 'lastCommitDate'}
                            class:text-slate-700={sortBy !== 'lastCommitDate'}
                        >
                            Last Commit {sortBy === 'lastCommitDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Repositories List -->
        <div class="grid gap-4">
            {#each repositories as repo}
                <Card>
                    <CardContent>
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <GitBranch class="h-5 w-5 text-slate-500" />
                                    <h3 class="text-lg font-semibold text-slate-900">
                                        {repo.fullName}
                                    </h3>
                                    {#if repo.isFork}
                                        <span
                                            class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                                        >
                                            Fork
                                        </span>
                                    {/if}
                                </div>

                                {#if repo.parentFullName}
                                    <p class="mt-1 text-sm text-slate-600">
                                        Fork of
                                        <span class="font-medium">{repo.parentFullName}</span>
                                    </p>
                                {/if}

                                <div class="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                                    <span
                                        >Default branch: <span class="font-medium"
                                            >{repo.defaultBranch}</span
                                        ></span
                                    >
                                    <span
                                        >Agency: <span class="font-medium"
                                            >{getAgencyName(repo.agencyId)}</span
                                        ></span
                                    >
                                    <span
                                        >Commits: <span class="font-medium"
                                            >{repo.commitCount.toLocaleString()}</span
                                        ></span
                                    >
                                    <span
                                        >Contributors: <span class="font-medium"
                                            >{repo.contributorCount.toLocaleString()}</span
                                        ></span
                                    >
                                </div>

                                <div class="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                                    {#if repo.lastCommitDate}
                                        <span
                                            >Last commit: <span class="font-medium"
                                                >{formatDate(repo.lastCommitDate)}</span
                                            ></span
                                        >
                                    {:else}
                                        <span>No commits yet</span>
                                    {/if}
                                    {#if repo.lastSyncedAt}
                                        <span
                                            >Last synced: <span class="font-medium"
                                                >{formatDate(repo.lastSyncedAt)}</span
                                            ></span
                                        >
                                    {:else}
                                        <span class="text-slate-400">Never synced</span>
                                    {/if}
                                </div>
                            </div>

                            <div class="ml-4 flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => goto(`/repositories/${repo.id}`)}
                                >
                                    View Details
                                </Button>
                                <a
                                    href={`https://github.com/${repo.fullName}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Button variant="outline" size="sm">
                                        <ExternalLink class="h-4 w-4" />
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            {/each}

            {#if repositories.length === 0}
                <Card>
                    <CardContent>
                        <div class="py-12 text-center">
                            <GitBranch class="mx-auto mb-4 h-12 w-12 text-slate-400" />
                            <p class="text-slate-500">No repositories found</p>
                            {#if searchQuery || selectedAgencyId || showForksOnly}
                                <p class="mt-2 text-sm text-slate-400">
                                    Try adjusting your filters
                                </p>
                            {/if}
                        </div>
                    </CardContent>
                </Card>
            {/if}
        </div>
    {/if}
</div>
