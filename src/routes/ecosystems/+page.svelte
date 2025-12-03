<script lang="ts">
    import { onMount } from 'svelte';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import EcosystemTree from '$lib/components/EcosystemTree.svelte';
    import { FolderTree, Plus, X, Save } from '@lucide/svelte';

    interface Ecosystem {
        id: number;
        name: string;
        parentId: number | null;
        createdAt: string;
        updatedAt: string;
    }

    let ecosystems = $state<Ecosystem[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let editingId = $state<number | null>(null);
    let creating = $state(false);
    let formData = $state({
        name: '',
        parentId: null as number | null,
    });

    async function loadEcosystems() {
        try {
            loading = true;
            error = null;
            const response = await fetch('/api/ecosystems');
            if (!response.ok) {
                throw new Error('Failed to load ecosystems');
            }
            const data = await response.json();
            ecosystems = data.data || [];
        } catch (err: any) {
            error = err.message || 'Failed to load ecosystems';
            console.error('Error loading ecosystems:', err);
        } finally {
            loading = false;
        }
    }

    function startCreate() {
        creating = true;
        editingId = null;
        formData = { name: '', parentId: null };
    }

    function startEdit(ecosystem: Ecosystem) {
        editingId = ecosystem.id;
        creating = false;
        formData = {
            name: ecosystem.name,
            parentId: ecosystem.parentId,
        };
    }

    function cancelEdit() {
        editingId = null;
        creating = false;
        formData = { name: '', parentId: null };
    }

    async function saveEcosystem() {
        try {
            error = null;
            const url = creating ? '/api/ecosystems' : `/api/ecosystems/${editingId}`;
            const method = creating ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    parentId: formData.parentId || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save ecosystem');
            }

            await loadEcosystems();
            cancelEdit();
        } catch (err: any) {
            error = err.message || 'Failed to save ecosystem';
            console.error('Error saving ecosystem:', err);
        }
    }

    async function deleteEcosystem(id: number) {
        if (!confirm('Are you sure you want to delete this ecosystem?')) {
            return;
        }

        try {
            error = null;
            const response = await fetch(`/api/ecosystems/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete ecosystem');
            }

            await loadEcosystems();
        } catch (err: any) {
            error = err.message || 'Failed to delete ecosystem';
            console.error('Error deleting ecosystem:', err);
        }
    }

    function startCreateChild(parentId: number) {
        creating = true;
        editingId = null;
        formData = { name: '', parentId };
    }

    function getEcosystemName(id: number | null): string {
        if (!id) return 'None';
        const ecosystem = ecosystems.find((e) => e.id === id);
        return ecosystem?.name || 'Unknown';
    }

    onMount(() => {
        loadEcosystems();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-slate-900">Ecosystems</h1>
            <p class="mt-2 text-slate-600">Manage ecosystem hierarchy</p>
        </div>
        <Button onclick={startCreate} disabled={creating || editingId !== null}>
            <Plus class="mr-2 h-4 w-4" />
            Add Ecosystem
        </Button>
    </div>

    {#if error}
        <div class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-800">{error}</div>
        </div>
    {/if}

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <div class="text-slate-500">Loading ecosystems...</div>
        </div>
    {:else}
        <!-- Create/Edit Form -->
        {#if creating || editingId !== null}
            <Card>
                <CardHeader>
                    <h2 class="text-lg font-semibold">
                        {creating ? 'Create New Ecosystem' : 'Edit Ecosystem'}
                    </h2>
                </CardHeader>
                <CardContent>
                    <form
                        onsubmit={(e) => {
                            e.preventDefault();
                            saveEcosystem();
                        }}
                        class="space-y-4"
                    >
                        <div>
                            <label for="form-name" class="mb-1 block text-sm font-medium text-slate-700">
                                Name *
                            </label>
                            <input
                                id="form-name"
                                type="text"
                                bind:value={formData.name}
                                required
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                placeholder="Ecosystem name"
                            />
                        </div>
                        <div>
                            <label for="form-parent" class="mb-1 block text-sm font-medium text-slate-700">
                                Parent Ecosystem
                            </label>
                            <select
                                id="form-parent"
                                bind:value={formData.parentId}
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                            >
                                <option value={null}>None (Root ecosystem)</option>
                                {#each ecosystems.filter((e) => e.id !== editingId) as eco}
                                    <option value={eco.id}>{eco.name}</option>
                                {/each}
                            </select>
                            <p class="mt-1 text-xs text-slate-500">
                                {formData.parentId
                                    ? `This will be a child of "${getEcosystemName(formData.parentId)}"`
                                    : 'This will be a root-level ecosystem'}
                            </p>
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

        <!-- Ecosystems Tree -->
        <Card>
            <CardContent>
                {#if ecosystems.length === 0}
                    <div class="py-12 text-center">
                        <FolderTree class="mx-auto mb-4 h-12 w-12 text-slate-400" />
                        <p class="text-slate-500">No ecosystems found</p>
                        <Button class="mt-4" onclick={startCreate}>
                            <Plus class="mr-2 h-4 w-4" />
                            Create your first ecosystem
                        </Button>
                    </div>
                {:else}
                    <EcosystemTree
                        {ecosystems}
                        {editingId}
                        onEdit={startEdit}
                        onDelete={deleteEcosystem}
                        onCreate={startCreateChild}
                    />
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>
