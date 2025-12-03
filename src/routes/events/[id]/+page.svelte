<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import {
        Calendar,
        ArrowLeft,
        Users,
        GitBranch,
        Plus,
        X,
        Building2,
        ExternalLink,
    } from '@lucide/svelte';
    import { formatDateRange } from '$lib/utils/date';

    interface Event {
        id: number;
        name: string;
        description: string | null;
        startDate: string | null;
        endDate: string | null;
        agencyId: number | null;
        createdAt: string;
        updatedAt: string;
    }

    interface Author {
        id: number;
        githubId: number | null;
        username: string | null;
        name: string | null;
        email: string | null;
    }

    interface Repository {
        id: number;
        githubId: number;
        fullName: string;
        isFork: boolean;
        defaultBranch: string;
    }

    interface Agency {
        id: number;
        name: string;
    }

    let event = $state<Event | null>(null);
    let associatedAuthors = $state<Author[]>([]);
    let associatedRepositories = $state<Repository[]>([]);
    let agencies = $state<Agency[]>([]);
    let allAuthors = $state<Author[]>([]);
    let allRepositories = $state<Repository[]>([]);

    let loading = $state(true);
    let error = $state<string | null>(null);
    let showAuthorPicker = $state(false);
    let showRepoPicker = $state(false);
    let loadingAssociations = $state(false);

    const eventId = parseInt(page.params.id || '0', 10);

    async function loadEvent() {
        try {
            loading = true;
            error = null;

            const response = await fetch(`/api/events/${eventId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Event not found');
                }
                throw new Error('Failed to load event');
            }

            const data = await response.json();
            event = data.data;
        } catch (err: any) {
            error = err.message || 'Failed to load event';
            console.error('Error loading event:', err);
        } finally {
            loading = false;
        }
    }

    async function loadAssociations() {
        try {
            loadingAssociations = true;

            // Load associated authors
            const authorsResponse = await fetch(`/api/events/${eventId}/authors`);
            if (authorsResponse.ok) {
                const authorsData = await authorsResponse.json();
                associatedAuthors = authorsData.data || [];
            }

            // Load associated repositories
            const reposResponse = await fetch(`/api/events/${eventId}/repositories`);
            if (reposResponse.ok) {
                const reposData = await reposResponse.json();
                associatedRepositories = reposData.data || [];
            }
        } catch (err) {
            console.error('Error loading associations:', err);
        } finally {
            loadingAssociations = false;
        }
    }

    async function loadAllAuthors() {
        try {
            const response = await fetch('/api/authors');
            if (response.ok) {
                const data = await response.json();
                allAuthors = data.data || [];
            }
        } catch (err) {
            console.error('Error loading authors:', err);
        }
    }

    async function loadAllRepositories() {
        try {
            const response = await fetch('/api/repositories');
            if (response.ok) {
                const data = await response.json();
                allRepositories = data.data || [];
            }
        } catch (err) {
            console.error('Error loading repositories:', err);
        }
    }

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

    async function addAuthor(authorId: number) {
        try {
            const response = await fetch(`/api/events/${eventId}/authors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authorId }),
            });

            if (!response.ok) {
                throw new Error('Failed to add author');
            }

            await loadAssociations();
            showAuthorPicker = false;
        } catch (err) {
            console.error('Error adding author:', err);
            error = 'Failed to add author';
        }
    }

    async function removeAuthor(authorId: number) {
        if (!confirm('Remove this author from the event?')) {
            return;
        }

        try {
            const response = await fetch(`/api/events/${eventId}/authors`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authorId }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove author');
            }

            await loadAssociations();
        } catch (err) {
            console.error('Error removing author:', err);
            error = 'Failed to remove author';
        }
    }

    async function addRepository(repositoryId: number) {
        try {
            const response = await fetch(`/api/events/${eventId}/repositories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repositoryId }),
            });

            if (!response.ok) {
                throw new Error('Failed to add repository');
            }

            await loadAssociations();
            showRepoPicker = false;
        } catch (err) {
            console.error('Error adding repository:', err);
            error = 'Failed to add repository';
        }
    }

    async function removeRepository(repositoryId: number) {
        if (!confirm('Remove this repository from the event?')) {
            return;
        }

        try {
            const response = await fetch(`/api/events/${eventId}/repositories`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repositoryId }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove repository');
            }

            await loadAssociations();
        } catch (err) {
            console.error('Error removing repository:', err);
            error = 'Failed to remove repository';
        }
    }

    function getAvailableAuthors(): Author[] {
        const associatedIds = new Set(associatedAuthors.map((a) => a.id));
        return allAuthors.filter((a) => !associatedIds.has(a.id));
    }

    function getAvailableRepositories(): Repository[] {
        const associatedIds = new Set(associatedRepositories.map((r) => r.id));
        return allRepositories.filter((r) => !associatedIds.has(r.id));
    }

    function getAgencyName(agencyId: number | null): string {
        if (!agencyId) return 'None';
        const agency = agencies.find((a) => a.id === agencyId);
        return agency?.name || 'Unknown';
    }

    function getAuthorDisplayName(author: Author): string {
        return author.name || author.username || author.email || 'Unknown';
    }

    onMount(async () => {
        await Promise.all([
            loadEvent(),
            loadAssociations(),
            loadAllAuthors(),
            loadAllRepositories(),
            loadAgencies(),
        ]);
    });
</script>

<div class="space-y-6">
    <!-- Back Button -->
    <Button variant="outline" onclick={() => goto('/events')}>
        <ArrowLeft class="mr-2 h-4 w-4" />
        Back to Events
    </Button>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <div class="text-slate-500">Loading event...</div>
        </div>
    {:else if error && !event}
        <div class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-800">{error}</div>
        </div>
    {:else if event}
        <!-- Event Header -->
        <div>
            <div class="flex items-center gap-2">
                <Calendar class="h-6 w-6 text-slate-500" />
                <h1 class="text-3xl font-bold text-slate-900">{event.name}</h1>
            </div>

            {#if event.description}
                <p class="mt-2 text-slate-600">{event.description}</p>
            {/if}

            <div class="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                {#if event.startDate || event.endDate}
                    <span>
                        <span class="font-medium">Date:</span>
                        {formatDateRange(event.startDate, event.endDate)}
                    </span>
                {/if}
                <span>
                    <span class="font-medium">Agency:</span>
                    {getAgencyName(event.agencyId)}
                </span>
            </div>
        </div>

        <!-- Associated Authors -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <Users class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">Contributors ({associatedAuthors.length})</h2>
                    </div>
                    {#if !showAuthorPicker}
                        <Button
                            size="sm"
                            onclick={() => {
                                showAuthorPicker = true;
                                showRepoPicker = false;
                            }}
                            disabled={loadingAssociations}
                        >
                            <Plus class="mr-2 h-4 w-4" />
                            Add Contributor
                        </Button>
                    {/if}
                </div>
            </CardHeader>
            <CardContent>
                {#if loadingAssociations}
                    <div class="text-sm text-slate-500">Loading...</div>
                {:else if showAuthorPicker}
                    <div class="space-y-3">
                        <div>
                            <label for="author-select" class="mb-2 block text-sm font-medium">
                                Select a contributor
                            </label>
                            <select
                                id="author-select"
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                onchange={(e) => {
                                    const target = e.target as HTMLSelectElement;
                                    if (target.value) {
                                        addAuthor(parseInt(target.value));
                                    }
                                }}
                            >
                                <option value="">Choose a contributor...</option>
                                {#each getAvailableAuthors() as author}
                                    <option value={author.id}>{getAuthorDisplayName(author)}</option>
                                {/each}
                            </select>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => (showAuthorPicker = false)}
                        >
                            Cancel
                        </Button>
                    </div>
                {:else if associatedAuthors.length === 0}
                    <div class="text-center py-8">
                        <Users class="mx-auto h-12 w-12 text-slate-400 mb-3" />
                        <p class="text-sm text-slate-500">No contributors associated with this event</p>
                        <Button
                            size="sm"
                            class="mt-3"
                            onclick={() => {
                                showAuthorPicker = true;
                                showRepoPicker = false;
                            }}
                        >
                            <Plus class="mr-2 h-4 w-4" />
                            Add Contributor
                        </Button>
                    </div>
                {:else}
                    <div class="space-y-2">
                        {#each associatedAuthors as author}
                            <div class="flex items-center justify-between p-3 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div class="flex items-center gap-3">
                                    <Users class="h-4 w-4 text-slate-500" />
                                    <div>
                                        <div class="font-medium text-slate-900">
                                            {getAuthorDisplayName(author)}
                                        </div>
                                        {#if author.username}
                                            <div class="text-xs text-slate-500">@{author.username}</div>
                                        {/if}
                                    </div>
                                </div>
                                <button
                                    onclick={() => removeAuthor(author.id)}
                                    class="text-slate-400 hover:text-red-600"
                                    title="Remove contributor"
                                >
                                    <X class="h-4 w-4" />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Associated Repositories -->
        <Card>
            <CardHeader>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <GitBranch class="h-5 w-5 text-slate-500" />
                        <h2 class="text-lg font-semibold">
                            Repositories ({associatedRepositories.length})
                        </h2>
                    </div>
                    {#if !showRepoPicker}
                        <Button
                            size="sm"
                            onclick={() => {
                                showRepoPicker = true;
                                showAuthorPicker = false;
                            }}
                            disabled={loadingAssociations}
                        >
                            <Plus class="mr-2 h-4 w-4" />
                            Add Repository
                        </Button>
                    {/if}
                </div>
            </CardHeader>
            <CardContent>
                {#if loadingAssociations}
                    <div class="text-sm text-slate-500">Loading...</div>
                {:else if showRepoPicker}
                    <div class="space-y-3">
                        <div>
                            <label for="repo-select" class="mb-2 block text-sm font-medium">
                                Select a repository
                            </label>
                            <select
                                id="repo-select"
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                onchange={(e) => {
                                    const target = e.target as HTMLSelectElement;
                                    if (target.value) {
                                        addRepository(parseInt(target.value));
                                    }
                                }}
                            >
                                <option value="">Choose a repository...</option>
                                {#each getAvailableRepositories() as repo}
                                    <option value={repo.id}>{repo.fullName}</option>
                                {/each}
                            </select>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => (showRepoPicker = false)}
                        >
                            Cancel
                        </Button>
                    </div>
                {:else if associatedRepositories.length === 0}
                    <div class="text-center py-8">
                        <GitBranch class="mx-auto h-12 w-12 text-slate-400 mb-3" />
                        <p class="text-sm text-slate-500">No repositories associated with this event</p>
                        <Button
                            size="sm"
                            class="mt-3"
                            onclick={() => {
                                showRepoPicker = true;
                                showAuthorPicker = false;
                            }}
                        >
                            <Plus class="mr-2 h-4 w-4" />
                            Add Repository
                        </Button>
                    </div>
                {:else}
                    <div class="space-y-2">
                        {#each associatedRepositories as repo}
                            <div class="flex items-center justify-between p-3 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div class="flex items-center gap-3">
                                    <GitBranch class="h-4 w-4 text-slate-500" />
                                    <div>
                                        <a
                                            href={`/repositories/${repo.id}`}
                                            class="font-medium text-blue-600 hover:underline"
                                        >
                                            {repo.fullName}
                                        </a>
                                        {#if repo.isFork}
                                            <span class="ml-2 text-xs text-slate-500">(Fork)</span>
                                        {/if}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <a
                                        href={`https://github.com/${repo.fullName}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-slate-400 hover:text-slate-600"
                                        title="View on GitHub"
                                    >
                                        <ExternalLink class="h-4 w-4" />
                                    </a>
                                    <button
                                        onclick={() => removeRepository(repo.id)}
                                        class="text-slate-400 hover:text-red-600"
                                        title="Remove repository"
                                    >
                                        <X class="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>
