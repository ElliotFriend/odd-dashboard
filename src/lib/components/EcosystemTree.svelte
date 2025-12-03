<script lang="ts">
    import { ChevronRight, ChevronDown, FolderTree, Edit2, Trash2, Plus } from '@lucide/svelte';
    import Button from '$lib/components/ui/button.svelte';
    import { formatDate } from '$lib/utils/date';

    interface Ecosystem {
        id: number;
        name: string;
        parentId: number | null;
        createdAt: string;
        updatedAt: string;
    }

    interface EcosystemTreeProps {
        ecosystems: Ecosystem[];
        editingId?: number | null;
        onEdit?: (ecosystem: Ecosystem) => void;
        onDelete?: (id: number) => void;
        onCreate?: (parentId: number) => void;
    }

    let {
        ecosystems,
        editingId = null,
        onEdit,
        onDelete,
        onCreate,
    }: EcosystemTreeProps = $props();

    // Track expanded state for each ecosystem
    let expanded = $state<Map<number, boolean>>(new Map());

    function getChildren(parentId: number | null): Ecosystem[] {
        return ecosystems.filter((e) => e.parentId === parentId);
    }

    function toggleExpand(id: number) {
        const current = expanded.get(id) ?? true;
        expanded.set(id, !current);
        // Force reactivity
        expanded = new Map(expanded);
    }

    function isExpanded(id: number): boolean {
        return expanded.get(id) ?? true;
    }

    function hasChildren(id: number): boolean {
        return getChildren(id).length > 0;
    }

    // Recursive tree node snippet
    interface TreeNodeProps {
        ecosystem: Ecosystem;
        level: number;
    }
</script>

{#snippet treeNode(ecosystem: Ecosystem, level: number)}
    {@const children = getChildren(ecosystem.id)}
    {@const isEditingThis = editingId === ecosystem.id}
    {@const isExpandedState = isExpanded(ecosystem.id)}
    {@const childrenExist = hasChildren(ecosystem.id)}

    <div class="ecosystem-node">
        <div
            class="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-slate-50 transition-colors"
            style="padding-left: {level * 24 + 12}px"
        >
            <!-- Expand/Collapse Button -->
            <button
                onclick={() => toggleExpand(ecosystem.id)}
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-slate-200 rounded"
                disabled={!childrenExist}
            >
                {#if childrenExist}
                    {#if isExpandedState}
                        <ChevronDown class="h-4 w-4 text-slate-600" />
                    {:else}
                        <ChevronRight class="h-4 w-4 text-slate-600" />
                    {/if}
                {:else}
                    <div class="w-4 h-4"></div>
                {/if}
            </button>

            <!-- Icon -->
            <FolderTree class="h-5 w-5 text-slate-500 flex-shrink-0" />

            <!-- Name and Info -->
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <span class="font-medium text-slate-900">{ecosystem.name}</span>
                    {#if childrenExist}
                        <span class="text-xs text-slate-500">
                            ({children.length} {children.length === 1 ? 'child' : 'children'})
                        </span>
                    {/if}
                </div>
                <p class="text-xs text-slate-500">
                    Created {formatDate(ecosystem.createdAt)}
                </p>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-1 flex-shrink-0">
                {#if onCreate}
                    <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => onCreate(ecosystem.id)}
                        disabled={isEditingThis}
                        title="Add child ecosystem"
                    >
                        <Plus class="h-4 w-4" />
                    </Button>
                {/if}
                {#if onEdit}
                    <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => onEdit(ecosystem)}
                        disabled={isEditingThis}
                        title="Edit ecosystem"
                    >
                        <Edit2 class="h-4 w-4" />
                    </Button>
                {/if}
                {#if onDelete}
                    <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => onDelete(ecosystem.id)}
                        disabled={isEditingThis}
                        title="Delete ecosystem"
                    >
                        <Trash2 class="h-4 w-4 text-red-500" />
                    </Button>
                {/if}
            </div>
        </div>

        <!-- Children (recursive) -->
        {#if isExpandedState && childrenExist}
            <div class="border-l-2 border-slate-200 ml-6">
                {#each children as child}
                    {@render treeNode(child, level + 1)}
                {/each}
            </div>
        {/if}
    </div>
{/snippet}

<div class="ecosystem-tree space-y-1">
    {#each getChildren(null) as rootEcosystem}
        {@render treeNode(rootEcosystem, 0)}
    {/each}

    {#if ecosystems.length === 0}
        <div class="py-12 text-center text-slate-500">
            <FolderTree class="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <p>No ecosystems found</p>
        </div>
    {/if}
</div>

<style>
    .ecosystem-node {
        position: relative;
    }
</style>
