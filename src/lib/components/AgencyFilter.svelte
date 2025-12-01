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

    function handleChange(e: Event) {
        const target = e.currentTarget as HTMLSelectElement;
        const value = target.value === '' ? null : parseInt(target.value, 10);
        selectedAgencyId = value;
        if (onAgencyChange) {
            onAgencyChange(value);
        }
    }

    onMount(() => {
        loadAgencies();
    });
</script>

<div class={className}>
    <label
        for="agency-filter"
        class="block text-sm font-medium text-slate-700 mb-1"
    >
        Agency
    </label>
    <div class="relative">
        <Building2
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
        />
        <select
            id="agency-filter"
            value={selectedAgencyId?.toString() || ''}
            onchange={handleChange}
            disabled={loading}
            class="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
        >
            <option value="">All Agencies</option>
            {#each agencies as agency}
                <option value={agency.id.toString()}>{agency.name}</option>
            {/each}
        </select>
    </div>
</div>

