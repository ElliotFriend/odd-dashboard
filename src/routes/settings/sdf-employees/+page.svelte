<script lang="ts">
    import { onMount } from 'svelte';
    import Button from '$lib/components/ui/button.svelte';
    import Card from '$lib/components/ui/card.svelte';
    import CardHeader from '$lib/components/ui/card-header.svelte';
    import CardContent from '$lib/components/ui/card-content.svelte';
    import LoadingState from '$lib/components/LoadingState.svelte';
    import ErrorAlert from '$lib/components/ErrorAlert.svelte';
    import { Users, Save, RefreshCw } from '@lucide/svelte';

    let usernames = $state('');
    let loading = $state(true);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);
    let currentSdfEmployees = $state<string[]>([]);

    async function loadCurrentSdfEmployees() {
        try {
            loading = true;
            error = null;

            const response = await fetch('/api/authors/sdf-employees');
            if (!response.ok) {
                throw new Error('Failed to load current SDF employees');
            }

            const data = await response.json();
            currentSdfEmployees = data.usernames || [];
            usernames = currentSdfEmployees.join('\n');
        } catch (err: any) {
            error = err.message || 'Failed to load SDF employees';
            console.error('Error loading SDF employees:', err);
        } finally {
            loading = false;
        }
    }

    async function saveSdfEmployees() {
        try {
            saving = true;
            error = null;
            successMessage = null;

            // Parse usernames from textarea (one per line, trim whitespace)
            const usernameList = usernames
                .split('\n')
                .map((u) => u.trim())
                .filter((u) => u.length > 0);

            const response = await fetch('/api/authors/sdf-employees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ usernames: usernameList }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update SDF employees');
            }

            const data = await response.json();
            successMessage = `Successfully updated SDF employees. ${data.updated} author(s) marked as SDF employees, ${data.cleared} cleared.`;

            // Reload the current list
            await loadCurrentSdfEmployees();
        } catch (err: any) {
            error = err.message || 'Failed to update SDF employees';
            console.error('Error saving SDF employees:', err);
        } finally {
            saving = false;
        }
    }

    onMount(() => {
        loadCurrentSdfEmployees();
    });
</script>

<div class="space-y-6">
    <div>
        <h1 class="text-3xl font-bold text-slate-900">SDF Employees</h1>
        <p class="mt-2 text-slate-600">
            Manage the list of GitHub usernames that belong to SDF employees
        </p>
    </div>

    {#if loading}
        <LoadingState message="Loading SDF employees..." />
    {:else if error && !saving}
        <ErrorAlert title="Failed to load SDF employees" message={error} retry={loadCurrentSdfEmployees} />
    {:else}
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    <Users class="h-5 w-5 text-slate-500" />
                    <h2 class="text-lg font-semibold">GitHub Usernames</h2>
                </div>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    <div>
                        <label for="usernames" class="mb-2 block text-sm font-medium text-slate-700">
                            Enter GitHub usernames (one per line)
                        </label>
                        <textarea
                            id="usernames"
                            bind:value={usernames}
                            rows={15}
                            placeholder="username1
username2
username3"
                            class="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                        />
                        <p class="mt-2 text-sm text-slate-500">
                            Currently tracking {currentSdfEmployees.length} SDF employee{currentSdfEmployees.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {#if successMessage}
                        <div class="rounded-md bg-green-50 p-4">
                            <p class="text-sm font-medium text-green-800">{successMessage}</p>
                        </div>
                    {/if}

                    {#if error && saving}
                        <div class="rounded-md bg-red-50 p-4">
                            <p class="text-sm font-medium text-red-800">{error}</p>
                        </div>
                    {/if}

                    <div class="flex gap-3">
                        <Button onclick={saveSdfEmployees} disabled={saving}>
                            {#if saving}
                                <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            {:else}
                                <Save class="mr-2 h-4 w-4" />
                                Save Changes
                            {/if}
                        </Button>
                        <Button variant="outline" onclick={loadCurrentSdfEmployees} disabled={saving}>
                            <RefreshCw class="mr-2 h-4 w-4" />
                            Reload
                        </Button>
                    </div>

                    <div class="rounded-md border border-slate-200 bg-slate-50 p-4">
                        <h3 class="mb-2 text-sm font-semibold text-slate-900">How this works:</h3>
                        <ul class="list-inside list-disc space-y-1 text-sm text-slate-600">
                            <li>Paste GitHub usernames in the textarea above, one per line</li>
                            <li>Click "Save Changes" to mark these users as SDF employees</li>
                            <li>Authors with matching usernames will be marked with the SDF employee flag</li>
                            <li>You can exclude SDF employees from analytics using the checkboxes on each page</li>
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
    {/if}
</div>
