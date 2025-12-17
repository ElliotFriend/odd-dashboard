<script lang="ts">
    import { onMount } from 'svelte';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import { Plus, Edit2, Trash2, X, Save } from '@lucide/svelte';
    import { formatDate } from '$lib/utils/date';

    interface Agency {
        id: number;
        name: string;
        description: string | null;
        createdAt: string;
        updatedAt: string;
    }

    let agencies = $state<Agency[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let editingId = $state<number | null>(null);
    let creating = $state(false);
    let formData = $state({
        name: '',
        description: '',
    });
    let repoUrls = $state('');
    let savingRepos = $state(false);
    let repoSuccessMessage = $state<string | null>(null);
    let repoError = $state<string | null>(null);

    async function loadAgencies() {
        try {
            loading = true;
            error = null;
            const response = await fetch('/api/agencies');
            if (!response.ok) {
                throw new Error('Failed to load agencies');
            }
            const data = await response.json();
            agencies = data.data || [];
        } catch (err: any) {
            error = err.message || 'Failed to load agencies';
            console.error('Error loading agencies:', err);
        } finally {
            loading = false;
        }
    }

    function startCreate() {
        creating = true;
        editingId = null;
        formData = { name: '', description: '' };
    }

    function startEdit(agency: Agency) {
        editingId = agency.id;
        creating = false;
        formData = {
            name: agency.name,
            description: agency.description || '',
        };
    }

    function cancelEdit() {
        editingId = null;
        creating = false;
        formData = { name: '', description: '' };
        repoUrls = '';
        repoSuccessMessage = null;
        repoError = null;
    }

    async function associateRepositories() {
        if (!editingId) return;

        try {
            savingRepos = true;
            repoError = null;
            repoSuccessMessage = null;

            // Parse URLs from textarea (one per line, trim whitespace)
            const urls = repoUrls
                .split('\n')
                .map((u) => u.trim())
                .filter((u) => u.length > 0);

            const response = await fetch(`/api/agencies/${editingId}/repositories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to associate repositories');
            }

            const data = await response.json();
            repoSuccessMessage = `Successfully processed ${urls.length} URL(s). Associated: ${data.associated}, Created: ${data.created}, Errors: ${data.errors}`;

            // Clear the textarea after successful save
            repoUrls = '';
        } catch (err: any) {
            repoError = err.message || 'Failed to associate repositories';
            console.error('Error associating repositories:', err);
        } finally {
            savingRepos = false;
        }
    }

    async function saveAgency() {
        try {
            error = null;
            const url = creating ? '/api/agencies' : `/api/agencies/${editingId}`;
            const method = creating ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save agency');
            }

            await loadAgencies();
            cancelEdit();
        } catch (err: any) {
            error = err.message || 'Failed to save agency';
            console.error('Error saving agency:', err);
        }
    }

    async function deleteAgency(id: number) {
        if (!confirm('Are you sure you want to delete this agency?')) {
            return;
        }

        try {
            error = null;
            const response = await fetch(`/api/agencies/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete agency');
            }

            await loadAgencies();
        } catch (err: any) {
            error = err.message || 'Failed to delete agency';
            console.error('Error deleting agency:', err);
        }
    }

    onMount(() => {
        loadAgencies();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-slate-900">Agencies</h1>
            <p class="mt-2 text-slate-600">Manage agencies and organizations</p>
        </div>
        <Button onclick={startCreate} disabled={creating || editingId !== null}>
            <Plus class="mr-2 h-4 w-4" />
            Add Agency
        </Button>
    </div>

    {#if error}
        <div class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-800">{error}</div>
        </div>
    {/if}

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <div class="text-slate-500">Loading agencies...</div>
        </div>
    {:else}
        <!-- Create Form -->
        {#if creating}
            <Card>
                <CardHeader>
                    <h2 class="text-lg font-semibold">Create New Agency</h2>
                </CardHeader>
                <CardContent>
                    <form
                        onsubmit={(e) => {
                            e.preventDefault();
                            saveAgency();
                        }}
                        class="space-y-4"
                    >
                        <div>
                            <label
                                for="create-name"
                                class="mb-1 block text-sm font-medium text-slate-700"
                            >
                                Name *
                            </label>
                            <input
                                id="create-name"
                                type="text"
                                bind:value={formData.name}
                                required
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                placeholder="Agency name"
                            />
                        </div>
                        <div>
                            <label
                                for="create-description"
                                class="mb-1 block text-sm font-medium text-slate-700"
                            >
                                Description
                            </label>
                            <textarea
                                id="create-description"
                                bind:value={formData.description}
                                rows="3"
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                placeholder="Agency description"
                            ></textarea>
                        </div>
                        <div class="flex gap-2">
                            <Button type="submit">
                                <Save class="mr-2 h-4 w-4" />
                                Save
                            </Button>
                            <Button type="button" variant="outline" onclick={cancelEdit}>
                                <X class="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        {/if}

        <!-- Agencies List -->
        <div class="grid gap-4">
            {#each agencies as agency}
                {@const isEditing = editingId === agency.id}
                <Card>
                    {#if isEditing}
                        <CardHeader>
                            <h2 class="text-lg font-semibold">Edit Agency</h2>
                        </CardHeader>
                        <CardContent>
                            <form
                                onsubmit={(e) => {
                                    e.preventDefault();
                                    saveAgency();
                                }}
                                class="space-y-4"
                            >
                                <div>
                                    <label
                                        for="edit-name-{agency.id}"
                                        class="mb-1 block text-sm font-medium text-slate-700"
                                    >
                                        Name *
                                    </label>
                                    <input
                                        id="edit-name-{agency.id}"
                                        type="text"
                                        bind:value={formData.name}
                                        required
                                        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label
                                        for="edit-description-{agency.id}"
                                        class="mb-1 block text-sm font-medium text-slate-700"
                                    >
                                        Description
                                    </label>
                                    <textarea
                                        id="edit-description-{agency.id}"
                                        bind:value={formData.description}
                                        rows="3"
                                        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                    ></textarea>
                                </div>
                                <div class="flex gap-2">
                                    <Button type="submit">
                                        <Save class="mr-2 h-4 w-4" />
                                        Save
                                    </Button>
                                    <Button type="button" variant="outline" onclick={cancelEdit}>
                                        <X class="mr-2 h-4 w-4" />
                                        Cancel
                                    </Button>
                                </div>
                            </form>

                            <!-- Bulk Repository Association -->
                            <div class="mt-6 border-t border-slate-200 pt-6">
                                <h3 class="mb-4 text-base font-semibold text-slate-900">
                                    Associate Repositories
                                </h3>
                                <div class="space-y-4">
                                    <div>
                                        <label
                                            for="repo-urls-{agency.id}"
                                            class="mb-2 block text-sm font-medium text-slate-700"
                                        >
                                            Repository URLs (one per line)
                                        </label>
                                        <textarea
                                            id="repo-urls-{agency.id}"
                                            bind:value={repoUrls}
                                            rows={10}
                                            placeholder="https://github.com/owner/repo1
https://github.com/owner/repo2
https://github.com/owner/repo3"
                                            class="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                                        />
                                        <p class="mt-2 text-sm text-slate-500">
                                            Paste GitHub repository URLs. Each repository will be fetched from GitHub and associated with this agency.
                                        </p>
                                    </div>

                                    {#if repoSuccessMessage}
                                        <div class="rounded-md bg-green-50 p-4">
                                            <p class="text-sm font-medium text-green-800">{repoSuccessMessage}</p>
                                        </div>
                                    {/if}

                                    {#if repoError}
                                        <div class="rounded-md bg-red-50 p-4">
                                            <p class="text-sm font-medium text-red-800">{repoError}</p>
                                        </div>
                                    {/if}

                                    <Button onclick={associateRepositories} disabled={savingRepos || !repoUrls.trim()}>
                                        {#if savingRepos}
                                            <Save class="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        {:else}
                                            <Save class="mr-2 h-4 w-4" />
                                            Associate Repositories
                                        {/if}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    {:else}
                        <CardContent>
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <h3 class="text-lg font-semibold text-slate-900">
                                        {agency.name}
                                    </h3>
                                    {#if agency.description}
                                        <p class="mt-1 text-sm text-slate-600">
                                            {agency.description}
                                        </p>
                                    {/if}
                                    <p class="mt-2 text-xs text-slate-500">
                                        Created {formatDate(agency.createdAt)} • Updated
                                        {formatDate(agency.updatedAt)}
                                    </p>
                                </div>
                                <div class="ml-4 flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onclick={() => startEdit(agency)}
                                        disabled={creating || editingId !== null}
                                    >
                                        <Edit2 class="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onclick={() => deleteAgency(agency.id)}
                                        disabled={creating || editingId !== null}
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    {/if}
                </Card>
            {/each}

            {#if agencies.length === 0}
                <Card>
                    <CardContent>
                        <div class="py-12 text-center">
                            <p class="text-slate-500">No agencies found</p>
                            <Button class="mt-4" onclick={startCreate}>
                                <Plus class="mr-2 h-4 w-4" />
                                Create your first agency
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            {/if}
        </div>
    {/if}
</div>
