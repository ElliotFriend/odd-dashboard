<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import { GitBranch, Search, Filter, ExternalLink } from '@lucide/svelte';
    import { formatDate } from '$lib/utils/date';

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

    interface Agency {
        id: number;
        name: string;
    }

    let repositories = $state<Repository[]>([]);
    let agencies = $state<Agency[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // Filters
    let searchQuery = $state('');
    let selectedAgencyId = $state<number | null>(null);
    let showForksOnly = $state(false);

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
            if (showForksOnly) {
                params.set('isFork', 'true');
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

    function getAgencyName(agencyId: number | null): string {
        if (!agencyId) return 'No agency';
        const agency = agencies.find((a) => a.id === agencyId);
        return agency?.name || 'Unknown';
    }

    onMount(() => {
        loadAgencies();
        loadRepositories();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-slate-900">Repositories</h1>
            <p class="mt-2 text-slate-600">Browse and manage GitHub repositories</p>
        </div>
    </div>

    <!-- Filters -->
    <Card>
        <CardContent>
            <div class="space-y-4">
                <div class="flex items-center gap-2">
                    <Filter class="w-5 h-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">Filters</h2>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <!-- Search -->
                    <div>
                        <label
                            for="search"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Search
                        </label>
                        <div class="relative">
                            <Search
                                class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
                            />
                            <input
                                id="search"
                                type="text"
                                bind:value={searchQuery}
                                oninput={handleFilterChange}
                                placeholder="Search repositories..."
                                class="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                            />
                        </div>
                    </div>

                    <!-- Agency Filter -->
                    <div>
                        <label
                            for="agency"
                            class="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Agency
                        </label>
                        <select
                            id="agency"
                            bind:value={selectedAgencyId}
                            onchange={handleFilterChange}
                            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                        >
                            <option value={null}>All Agencies</option>
                            {#each agencies as agency}
                                <option value={agency.id}>{agency.name}</option>
                            {/each}
                        </select>
                    </div>

                    <!-- Fork Filter -->
                    <div class="flex items-end">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                bind:checked={showForksOnly}
                                onchange={handleFilterChange}
                                class="w-4 h-4 text-slate-600 border-slate-300 rounded focus:ring-slate-500"
                            />
                            <span class="text-sm font-medium text-slate-700">Forks only</span>
                        </label>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>

    {#if error}
        <div class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-800">{error}</div>
        </div>
    {/if}

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <div class="text-slate-500">Loading repositories...</div>
        </div>
    {:else}
        <!-- Repositories List -->
        <div class="grid gap-4">
            {#each repositories as repo}
                <Card>
                    <CardContent>
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <GitBranch class="w-5 h-5 text-slate-500" />
                                    <h3 class="text-lg font-semibold text-slate-900">
                                        {repo.fullName}
                                    </h3>
                                    {#if repo.isFork}
                                        <span
                                            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
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
                                    <span>Default branch: <span class="font-medium">{repo.defaultBranch}</span></span>
                                    <span>Agency: <span class="font-medium">{getAgencyName(repo.agencyId)}</span></span>
                                    {#if repo.lastSyncedAt}
                                        <span>Last synced: <span class="font-medium">{formatDate(repo.lastSyncedAt)}</span></span>
                                    {:else}
                                        <span class="text-slate-400">Never synced</span>
                                    {/if}
                                </div>

                                <p class="mt-2 text-xs text-slate-500">
                                    Created {formatDate(repo.createdAt)} • Updated
                                    {formatDate(repo.updatedAt)}
                                </p>
                            </div>

                            <div class="flex gap-2 ml-4">
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
                                        <ExternalLink class="w-4 h-4" />
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
                        <div class="text-center py-12">
                            <GitBranch class="w-12 h-12 text-slate-400 mx-auto mb-4" />
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

