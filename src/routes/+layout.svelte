<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import './layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import Button from '$lib/components/ui/button.svelte';
    import { House, GitBranch, Users, FolderTree, Building2, Calendar } from '@lucide/svelte';
    import { setupChartJS } from '$lib/utils/chart-setup';

    let { children } = $props();

    // Initialize Chart.js on mount to ensure it runs client-side
    onMount(() => {
        setupChartJS();
    });

    const navigation = [
        { name: 'Dashboard', href: '/', icon: House },
        { name: 'Repositories', href: '/repositories', icon: GitBranch },
        { name: 'Contributors', href: '/contributors', icon: Users },
        { name: 'Ecosystems', href: '/ecosystems', icon: FolderTree },
        { name: 'Agencies', href: '/agencies', icon: Building2 },
        { name: 'Events', href: '/events', icon: Calendar },
    ];

    function isActive(href: string): boolean {
        if (href === '/') {
            return page.url.pathname === '/';
        }
        return page.url.pathname.startsWith(href);
    }
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <title>GitHub Contribution Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-slate-50">
    <!-- Navigation Sidebar -->
    <aside class="fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white">
        <div class="flex h-full flex-col">
            <!-- Logo/Header -->
            <div class="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
                <GitBranch class="h-6 w-6 text-slate-900" />
                <h1 class="text-xl font-bold text-slate-900">Contribution Dashboard</h1>
            </div>

            <!-- Navigation Links -->
            <nav class="flex-1 space-y-1 px-4 py-4">
                {#each navigation as item}
                    {@const Icon = item.icon}
                    {@const active = isActive(item.href)}
                    <button
                        onclick={() => goto(item.href)}
                        class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors {active
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
                    >
                        <Icon class="h-5 w-5" />
                        <span>{item.name}</span>
                    </button>
                {/each}
            </nav>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="pl-64">
        <div class="container mx-auto px-8 py-8">
            {@render children()}
        </div>
    </main>
</div>
