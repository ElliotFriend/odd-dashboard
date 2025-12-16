<script lang="ts">
    import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@lucide/svelte';
    import Button from './button.svelte';

    interface PaginationProps {
        currentPage: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (pageSize: number) => void;
        pageSizeOptions?: number[];
    }

    let {
        currentPage = 1,
        pageSize = 100,
        total = 0,
        onPageChange,
        onPageSizeChange,
        pageSizeOptions = [50, 100, 250, 500],
    }: PaginationProps = $props();

    const totalPages = $derived(Math.ceil(total / pageSize));
    const startItem = $derived((currentPage - 1) * pageSize + 1);
    const endItem = $derived(Math.min(currentPage * pageSize, total));

    function goToFirstPage() {
        if (currentPage > 1) {
            onPageChange(1);
        }
    }

    function goToPreviousPage() {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    }

    function goToNextPage() {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    }

    function goToLastPage() {
        if (currentPage < totalPages) {
            onPageChange(totalPages);
        }
    }

    function handlePageSizeChange(event: Event) {
        const newSize = parseInt((event.target as HTMLSelectElement).value, 10);
        onPageSizeChange(newSize);
    }
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <!-- Page size selector -->
    <div class="flex items-center gap-2">
        <label for="page-size" class="text-sm font-medium text-slate-700">Show:</label>
        <select
            id="page-size"
            value={pageSize}
            onchange={handlePageSizeChange}
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
            {#each pageSizeOptions as option}
                <option value={option}>{option}</option>
            {/each}
        </select>
        <span class="text-sm text-slate-600">per page</span>
    </div>

    <!-- Pagination info and controls -->
    <div class="flex items-center gap-4">
        <!-- Results info -->
        <div class="text-sm text-slate-600">
            {#if total > 0}
                Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of {total.toLocaleString()} results
            {:else}
                No results
            {/if}
        </div>

        <!-- Navigation buttons -->
        {#if totalPages > 1}
            <div class="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onclick={goToFirstPage}
                    disabled={currentPage === 1}
                    title="First page"
                >
                    <ChevronsLeft class="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onclick={goToPreviousPage}
                    disabled={currentPage === 1}
                    title="Previous page"
                >
                    <ChevronLeft class="h-4 w-4" />
                </Button>

                <!-- Page indicator -->
                <div class="mx-2 text-sm font-medium text-slate-700">
                    Page {currentPage} of {totalPages}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onclick={goToNextPage}
                    disabled={currentPage === totalPages}
                    title="Next page"
                >
                    <ChevronRight class="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onclick={goToLastPage}
                    disabled={currentPage === totalPages}
                    title="Last page"
                >
                    <ChevronsRight class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    </div>
</div>
