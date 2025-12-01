<script lang="ts">
    import { Calendar } from '@lucide/svelte';

    interface DateRangePickerProps {
        startDate?: string;
        endDate?: string;
        onDateChange?: (startDate: string, endDate: string) => void;
        class?: string;
    }

    let {
        startDate = $bindable(''),
        endDate = $bindable(''),
        onDateChange,
        class: className = '',
    }: DateRangePickerProps = $props();

    $effect(() => {
        if (onDateChange && startDate && endDate) {
            onDateChange(startDate, endDate);
        }
    });
</script>

<div class="flex items-center gap-4 {className}">
    <div class="flex-1">
        <label
            for="start-date-picker"
            class="block text-sm font-medium text-slate-700 mb-1"
        >
            Start Date
        </label>
        <div class="relative">
            <Calendar
                class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
            />
            <input
                id="start-date-picker"
                type="date"
                bind:value={startDate}
                class="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
        </div>
    </div>
    <div class="flex-1">
        <label
            for="end-date-picker"
            class="block text-sm font-medium text-slate-700 mb-1"
        >
            End Date
        </label>
        <div class="relative">
            <Calendar
                class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
            />
            <input
                id="end-date-picker"
                type="date"
                bind:value={endDate}
                class="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
        </div>
    </div>
</div>

