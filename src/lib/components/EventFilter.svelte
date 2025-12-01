<script lang="ts">
    import { onMount } from 'svelte';
    import { Calendar } from '@lucide/svelte';

    interface Event {
        id: number;
        name: string;
    }

    interface EventFilterProps {
        selectedEventId?: number | null;
        onEventChange?: (eventId: number | null) => void;
        class?: string;
    }

    let {
        selectedEventId = $bindable(null),
        onEventChange,
        class: className = '',
    }: EventFilterProps = $props();

    let events = $state<Event[]>([]);
    let loading = $state(true);

    async function loadEvents() {
        try {
            loading = true;
            const response = await fetch('/api/events');
            if (response.ok) {
                const data = await response.json();
                events = data.data || [];
            }
        } catch (err) {
            console.error('Error loading events:', err);
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        if (onEventChange) {
            onEventChange(selectedEventId);
        }
    });

    onMount(() => {
        loadEvents();
    });
</script>

<div class={className}>
    <label
        for="event-filter"
        class="block text-sm font-medium text-slate-700 mb-1"
    >
        Event
    </label>
    <div class="relative">
        <Calendar
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
        />
        <select
            id="event-filter"
            bind:value={selectedEventId}
            disabled={loading}
            class="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
        >
            <option value={null}>All Events</option>
            {#each events as event}
                <option value={event.id}>{event.name}</option>
            {/each}
        </select>
    </div>
</div>

