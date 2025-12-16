<script lang="ts">
    import { onMount } from 'svelte';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import { Calendar, Plus, Pencil, Trash2, X, Save } from '@lucide/svelte';
    import { formatDate, formatDateRange } from '$lib/utils/date';

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

    interface Agency {
        id: number;
        name: string;
    }

    let events = $state<Event[]>([]);
    let agencies = $state<Agency[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let editingId = $state<number | null>(null);
    let creating = $state(false);
    let formData = $state({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        agencyId: null as number | null,
    });

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
            loading = true;
            error = null;
            const response = await fetch('/api/events');
            if (!response.ok) {
                throw new Error('Failed to load events');
            }
            const data = await response.json();
            events = data.data || [];
        } catch (err: any) {
            error = err.message || 'Failed to load events';
            console.error('Error loading events:', err);
        } finally {
            loading = false;
        }
    }

    function startCreate() {
        creating = true;
        editingId = null;
        formData = {
            name: '',
            description: '',
            startDate: '',
            endDate: '',
            agencyId: null,
        };
    }

    function startEdit(event: Event) {
        editingId = event.id;
        creating = false;
        formData = {
            name: event.name,
            description: event.description || '',
            startDate: event.startDate ? event.startDate.split('T')[0] : '',
            endDate: event.endDate ? event.endDate.split('T')[0] : '',
            agencyId: event.agencyId,
        };
    }

    function cancelEdit() {
        editingId = null;
        creating = false;
        formData = {
            name: '',
            description: '',
            startDate: '',
            endDate: '',
            agencyId: null,
        };
    }

    async function saveEvent() {
        try {
            error = null;
            const url = creating ? '/api/events' : `/api/events/${editingId}`;
            const method = creating ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description || null,
                    startDate: formData.startDate || null,
                    endDate: formData.endDate || null,
                    agencyId: formData.agencyId || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save event');
            }

            await loadEvents();
            cancelEdit();
        } catch (err: any) {
            error = err.message || 'Failed to save event';
            console.error('Error saving event:', err);
        }
    }

    async function deleteEvent(id: number) {
        if (!confirm('Are you sure you want to delete this event?')) {
            return;
        }

        try {
            error = null;
            const response = await fetch(`/api/events/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete event');
            }

            await loadEvents();
        } catch (err: any) {
            error = err.message || 'Failed to delete event';
            console.error('Error deleting event:', err);
        }
    }

    function getAgencyName(agencyId: number | null): string {
        if (!agencyId) return 'No agency';
        const agency = agencies.find((a) => a.id === agencyId);
        return agency?.name || 'Unknown';
    }

    onMount(async () => {
        await loadAgencies();
        await loadEvents();
    });
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-bold text-slate-900">Events</h1>
            <p class="mt-2 text-slate-600">Manage events like hackathons and conferences</p>
        </div>
        <Button onclick={startCreate} disabled={creating || editingId !== null}>
            <Plus class="mr-2 h-4 w-4" />
            Add Event
        </Button>
    </div>

    {#if error}
        <div class="rounded-md bg-red-50 p-4">
            <div class="text-sm text-red-800">{error}</div>
        </div>
    {/if}

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <div class="text-slate-500">Loading events...</div>
        </div>
    {:else}
        <!-- Create Form -->
        {#if creating}
            <Card>
                <CardHeader>
                    <h2 class="text-lg font-semibold">Create New Event</h2>
                </CardHeader>
                <CardContent>
                    <form
                        onsubmit={(e) => {
                            e.preventDefault();
                            saveEvent();
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
                                placeholder="Event name"
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
                                placeholder="Event description"
                            ></textarea>
                        </div>
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label
                                    for="create-start-date"
                                    class="mb-1 block text-sm font-medium text-slate-700"
                                >
                                    Start Date
                                </label>
                                <input
                                    id="create-start-date"
                                    type="date"
                                    bind:value={formData.startDate}
                                    class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label
                                    for="create-end-date"
                                    class="mb-1 block text-sm font-medium text-slate-700"
                                >
                                    End Date
                                </label>
                                <input
                                    id="create-end-date"
                                    type="date"
                                    bind:value={formData.endDate}
                                    class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label
                                for="create-agency"
                                class="mb-1 block text-sm font-medium text-slate-700"
                            >
                                Agency
                            </label>
                            <select
                                id="create-agency"
                                bind:value={formData.agencyId}
                                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                            >
                                <option value={null}>No agency</option>
                                {#each agencies as agency}
                                    <option value={agency.id}>{agency.name}</option>
                                {/each}
                            </select>
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

        <!-- Events List -->
        <div class="grid gap-4">
            {#each events as event}
                {@const isEditing = editingId === event.id}
                <Card>
                    {#if isEditing}
                        <CardHeader>
                            <h2 class="text-lg font-semibold">Edit Event</h2>
                        </CardHeader>
                        <CardContent>
                            <form
                                onsubmit={(e) => {
                                    e.preventDefault();
                                    saveEvent();
                                }}
                                class="space-y-4"
                            >
                                <div>
                                    <label
                                        for="edit-name-{event.id}"
                                        class="mb-1 block text-sm font-medium text-slate-700"
                                    >
                                        Name *
                                    </label>
                                    <input
                                        id="edit-name-{event.id}"
                                        type="text"
                                        bind:value={formData.name}
                                        required
                                        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label
                                        for="edit-description-{event.id}"
                                        class="mb-1 block text-sm font-medium text-slate-700"
                                    >
                                        Description
                                    </label>
                                    <textarea
                                        id="edit-description-{event.id}"
                                        bind:value={formData.description}
                                        rows="3"
                                        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                    ></textarea>
                                </div>
                                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label
                                            for="edit-start-date-{event.id}"
                                            class="mb-1 block text-sm font-medium text-slate-700"
                                        >
                                            Start Date
                                        </label>
                                        <input
                                            id="edit-start-date-{event.id}"
                                            type="date"
                                            bind:value={formData.startDate}
                                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label
                                            for="edit-end-date-{event.id}"
                                            class="mb-1 block text-sm font-medium text-slate-700"
                                        >
                                            End Date
                                        </label>
                                        <input
                                            id="edit-end-date-{event.id}"
                                            type="date"
                                            bind:value={formData.endDate}
                                            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label
                                        for="edit-agency-{event.id}"
                                        class="mb-1 block text-sm font-medium text-slate-700"
                                    >
                                        Agency
                                    </label>
                                    <select
                                        id="edit-agency-{event.id}"
                                        bind:value={formData.agencyId}
                                        class="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:outline-none"
                                    >
                                        <option value={null}>No agency</option>
                                        {#each agencies as agency}
                                            <option value={agency.id}>{agency.name}</option>
                                        {/each}
                                    </select>
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
                    {:else}
                        <CardContent>
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2">
                                        <Calendar class="h-5 w-5 text-slate-500" />
                                        <a href={`/events/${event.id}`} class="text-lg font-semibold text-blue-600 hover:underline">
                                            {event.name}
                                        </a>
                                    </div>
                                    {#if event.description}
                                        <p class="mt-1 text-sm text-slate-600">
                                            {event.description}
                                        </p>
                                    {/if}
                                    <div class="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                                        {#if event.startDate || event.endDate}
                                            <span>
                                                <Calendar class="mr-1 inline h-4 w-4" />
                                                {formatDateRange(event.startDate, event.endDate)}
                                            </span>
                                        {/if}
                                        <span
                                            >Agency: <span class="font-medium"
                                                >{getAgencyName(event.agencyId)}</span
                                            ></span
                                        >
                                    </div>
                                    <p class="mt-2 text-xs text-slate-500">
                                        Created {formatDate(event.createdAt)} • Updated
                                        {formatDate(event.updatedAt)}
                                    </p>
                                </div>
                                <div class="ml-4 flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onclick={() => startEdit(event)}
                                        disabled={creating || editingId !== null}
                                    >
                                        <Pencil class="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onclick={() => deleteEvent(event.id)}
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

            {#if events.length === 0}
                <Card>
                    <CardContent>
                        <div class="py-12 text-center">
                            <Calendar class="mx-auto mb-4 h-12 w-12 text-slate-400" />
                            <p class="text-slate-500">No events found</p>
                            <Button class="mt-4" onclick={startCreate}>
                                <Plus class="mr-2 h-4 w-4" />
                                Create your first event
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            {/if}
        </div>
    {/if}
</div>
