<script lang="ts">
    import { onMount } from 'svelte';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import { Plus, Edit2, Trash2, X, Save } from 'lucide-svelte';
    import { formatDate } from '$lib/utils/date';

    interface Agency {
        id: number;
        name: string;
        description: string | null;
        createdAt: string;
        updatedAt: string;
    }

    let agencies: Agency[] = [];
    let loading = true;
    let error: string | null = null;
    let editingId: number | null = null;
    let creating = false;
    let formData = {
        name: '',
        description: '',
    };

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
        <Button on:click={startCreate} disabled={creating || editingId !== null}>
            <Plus class="w-4 h-4 mr-2" />
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
                        on:submit|preventDefault={saveAgency}
                        class="space-y-4"
                    >
                        <div>
                            <label
                                for="create-name"
                                class="block text-sm font-medium text-slate-700 mb-1"
                            >
                                Name *
                            </label>
                            <input
                                id="create-name"
                                type="text"
                                bind:value={formData.name}
                                required
                                class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                                placeholder="Agency name"
                            />
                        </div>
                        <div>
                            <label
                                for="create-description"
                                class="block text-sm font-medium text-slate-700 mb-1"
                            >
                                Description
                            </label>
                            <textarea
                                id="create-description"
                                bind:value={formData.description}
                                rows="3"
                                class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                                placeholder="Agency description"
                            />
                        </div>
                        <div class="flex gap-2">
                            <Button type="submit">
                                <Save class="w-4 h-4 mr-2" />
                                Save
                            </Button>
                            <Button type="button" variant="outline" on:click={cancelEdit}>
                                <X class="w-4 h-4 mr-2" />
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
                                on:submit|preventDefault={saveAgency}
                                class="space-y-4"
                            >
                                <div>
                                    <label
                                        for="edit-name-{agency.id}"
                                        class="block text-sm font-medium text-slate-700 mb-1"
                                    >
                                        Name *
                                    </label>
                                    <input
                                        id="edit-name-{agency.id}"
                                        type="text"
                                        bind:value={formData.name}
                                        required
                                        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>
                                <div>
                                    <label
                                        for="edit-description-{agency.id}"
                                        class="block text-sm font-medium text-slate-700 mb-1"
                                    >
                                        Description
                                    </label>
                                    <textarea
                                        id="edit-description-{agency.id}"
                                        bind:value={formData.description}
                                        rows="3"
                                        class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>
                                <div class="flex gap-2">
                                    <Button type="submit">
                                        <Save class="w-4 h-4 mr-2" />
                                        Save
                                    </Button>
                                    <Button type="button" variant="outline" on:click={cancelEdit}>
                                        <X class="w-4 h-4 mr-2" />
                                        Cancel
                                    </Button>
                                </div>
                            </form>
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
                                <div class="flex gap-2 ml-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        on:click={() => startEdit(agency)}
                                        disabled={creating || editingId !== null}
                                    >
                                        <Edit2 class="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        on:click={() => deleteAgency(agency.id)}
                                        disabled={creating || editingId !== null}
                                    >
                                        <Trash2 class="w-4 h-4" />
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
                        <div class="text-center py-12">
                            <p class="text-slate-500">No agencies found</p>
                            <Button class="mt-4" on:click={startCreate}>
                                <Plus class="w-4 h-4 mr-2" />
                                Create your first agency
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            {/if}
        </div>
    {/if}
</div>

