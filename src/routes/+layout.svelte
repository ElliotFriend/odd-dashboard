<script lang="ts">
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import './layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import Button from '$lib/components/ui/button.svelte';
    import { Home, GitBranch, Users, FolderTree, Building2, Calendar } from '@lucide/svelte';

    let { children } = $props();

    const navigation = [
        { name: 'Dashboard', href: '/', icon: Home },
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
    <aside class="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200">
        <div class="flex flex-col h-full">
            <!-- Logo/Header -->
            <div class="flex items-center gap-2 px-6 py-4 border-b border-slate-200">
                <GitBranch class="w-6 h-6 text-slate-900" />
                <h1 class="text-xl font-bold text-slate-900">Contribution Dashboard</h1>
            </div>

            <!-- Navigation Links -->
            <nav class="flex-1 px-4 py-4 space-y-1">
                {#each navigation as item}
                    {@const Icon = item.icon}
                    {@const active = isActive(item.href)}
                    <button
                        on:click={() => goto(item.href)}
                        class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors {active
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
                    >
                        <Icon class="w-5 h-5" />
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
