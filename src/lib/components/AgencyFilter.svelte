<script lang="ts">
    import { onMount } from 'svelte';
    import { Building2 } from '@lucide/svelte';

    interface Agency {
        id: number;
        name: string;
    }

    interface AgencyFilterProps {
        selectedAgencyId?: number | null;
        onAgencyChange?: (agencyId: number | null) => void;
        class?: string;
    }

    let {
        selectedAgencyId = $bindable(null),
        onAgencyChange,
        class: className = '',
    }: AgencyFilterProps = $props();

    let agencies = $state<Agency[]>([]);
    let loading = $state(true);

    async function loadAgencies() {
        try {
            loading = true;
            const response = await fetch('/api/agencies');
            if (response.ok) {
                const data = await response.json();
                agencies = data.data || [];
            }
        } catch (err) {
            console.error('Error loading agencies:', err);
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        if (onAgencyChange) {
            onAgencyChange(selectedAgencyId);
        }
    });

    onMount(() => {
        loadAgencies();
    });
</script>

<div class={className}>
    <label for="agency-filter" class="mb-1 block text-sm font-medium text-slate-700">
        Agency
    </label>
    <div class="relative">
        <Building2
            class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400"
        />
        <select
            id="agency-filter"
            bind:value={selectedAgencyId}
            disabled={loading}
            class="w-full rounded-md border border-slate-300 py-2 pr-3 pl-10 focus:ring-2 focus:ring-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        >
            <option value={null}>All Agencies</option>
            {#each agencies as agency}
                <option value={agency.id}>{agency.name}</option>
            {/each}
        </select>
    </div>
</div>
