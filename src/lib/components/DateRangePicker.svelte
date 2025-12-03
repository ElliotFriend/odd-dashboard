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
        <label for="start-date-picker" class="mb-1 block text-sm font-medium text-slate-700">
            Start Date
        </label>
        <div class="relative">
            <Calendar
                class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400"
            />
            <input
                id="start-date-picker"
                type="date"
                bind:value={startDate}
                class="w-full rounded-md border border-slate-300 py-2 pr-3 pl-10 focus:ring-2 focus:ring-slate-500 focus:outline-none"
            />
        </div>
    </div>
    <div class="flex-1">
        <label for="end-date-picker" class="mb-1 block text-sm font-medium text-slate-700">
            End Date
        </label>
        <div class="relative">
            <Calendar
                class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-slate-400"
            />
            <input
                id="end-date-picker"
                type="date"
                bind:value={endDate}
                class="w-full rounded-md border border-slate-300 py-2 pr-3 pl-10 focus:ring-2 focus:ring-slate-500 focus:outline-none"
            />
        </div>
    </div>
</div>
