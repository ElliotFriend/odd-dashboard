<script lang="ts">
    import { goto } from "$app/navigation";
    import { Upload, FileText, CircleAlert, CircleCheck, ArrowLeft } from "@lucide/svelte";
    import Card from "$lib/components/ui/card.svelte";
    import CardHeader from "$lib/components/ui/card-header.svelte";
    import CardContent from "$lib/components/ui/card-content.svelte";
    import Button from "$lib/components/ui/button.svelte";
    import LoadingState from "$lib/components/LoadingState.svelte";
    import ErrorAlert from "$lib/components/ErrorAlert.svelte";

    interface ImportResult {
        success: number;
        failed: number;
        errors: Array<{
            line: number;
            repo_url: string;
            error: string;
        }>;
    }

    let jsonlInput = $state("");
    let fileInput: HTMLInputElement;
    let importing = $state(false);
    let result = $state<ImportResult | null>(null);
    let error = $state<string | null>(null);

    const sampleData = `{"eco_name":"Stellar","branch":[],"repo_url":"https://github.com/stellar/go","tags":[]}
{"eco_name":"Ethereum","branch":["DeFi"],"repo_url":"https://github.com/Uniswap/v3-core","tags":[]}
{"eco_name":"Polkadot","branch":[],"repo_url":"https://github.com/paritytech/substrate","tags":[]}`;

    function handleFileUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            jsonlInput = e.target?.result as string;
        };
        reader.readAsText(file);
    }

    function loadSampleData() {
        jsonlInput = sampleData;
    }

    async function handleImport() {
        if (!jsonlInput.trim()) {
            error = "Please enter JSONL data or upload a file";
            return;
        }

        importing = true;
        error = null;
        result = null;

        try {
            const response = await fetch("/api/repositories/bulk-import", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ jsonl: jsonlInput }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to import repositories");
            }

            result = await response.json();
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to import repositories";
        } finally {
            importing = false;
        }
    }

    function reset() {
        jsonlInput = "";
        result = null;
        error = null;
        if (fileInput) {
            fileInput.value = "";
        }
    }
</script>

<div class="space-y-6">
    <div class="flex items-center gap-4">
        <Button variant="outline" onclick={() => goto("/repositories")}>
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to Repositories
        </Button>
    </div>

    <div>
        <h1 class="text-3xl font-bold text-slate-900">Bulk Import Repositories</h1>
        <p class="mt-2 text-slate-600">
            Import multiple repositories from JSONL format
        </p>
    </div>

    <!-- Instructions -->
    <Card>
        <CardHeader>
            <div class="flex items-center gap-2">
                <FileText class="h-5 w-5 text-slate-500" />
                <h2 class="text-lg font-semibold">Instructions</h2>
            </div>
        </CardHeader>
        <CardContent>
            <div class="space-y-3 text-sm">
                <p>
                    <strong>Format:</strong> One JSON object per line (JSONL format)
                </p>
                <div class="rounded-md bg-slate-50 p-3">
                    <code class="text-xs">
                        {"{"}"eco_name":"Stellar","branch":[],"repo_url":"https://github.com/stellar/go","tags":[]{"}"}<br
                        />
                        {"{"}"eco_name":"Ethereum","branch":["DeFi"],"repo_url":"https://github.com/Uniswap/v3-core","tags":[]{"}"}<br
                        />
                    </code>
                </div>
                <ul class="list-disc space-y-1 pl-5">
                    <li>
                        <strong>eco_name:</strong> Default ecosystem name
                    </li>
                    <li>
                        <strong>branch:</strong> Sub-ecosystem name (if present,
                        overrides eco_name)
                    </li>
                    <li>
                        <strong>repo_url:</strong> GitHub repository URL (required)
                    </li>
                    <li><strong>tags:</strong> Can be ignored</li>
                </ul>
                <Button variant="outline" size="sm" onclick={loadSampleData}>
                    Load Sample Data
                </Button>
            </div>
        </CardContent>
    </Card>

    <!-- Import Form -->
    <Card>
        <CardHeader>
            <div class="flex items-center gap-2">
                <Upload class="h-5 w-5 text-slate-500" />
                <h2 class="text-lg font-semibold">Import Data</h2>
            </div>
        </CardHeader>
        <CardContent>
            <div class="space-y-4">
                <!-- File Upload -->
                <div>
                    <label
                        for="file-upload"
                        class="mb-2 block text-sm font-medium text-slate-700"
                    >
                        Upload File
                    </label>
                    <input
                        id="file-upload"
                        type="file"
                        accept=".jsonl,.txt"
                        bind:this={fileInput}
                        onchange={handleFileUpload}
                        class="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                    />
                </div>

                <div class="text-center text-sm text-slate-500">OR</div>

                <!-- Textarea -->
                <div>
                    <label
                        for="jsonl-input"
                        class="mb-2 block text-sm font-medium text-slate-700"
                    >
                        Paste JSONL Data
                    </label>
                    <textarea
                        id="jsonl-input"
                        bind:value={jsonlInput}
                        rows={10}
                        placeholder="Paste JSONL data here (one JSON object per line)..."
                        class="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    ></textarea>
                    <div class="mt-1 text-xs text-slate-500">
                        {jsonlInput.split("\n").filter((line) => line.trim()).length} lines
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3">
                    <Button
                        onclick={handleImport}
                        disabled={importing || !jsonlInput.trim()}
                    >
                        {importing ? "Importing..." : "Import Repositories"}
                    </Button>
                    <Button variant="outline" onclick={reset} disabled={importing}>
                        Clear
                    </Button>
                </div>
            </div>
        </CardContent>
    </Card>

    <!-- Loading State -->
    {#if importing}
        <LoadingState message="Importing repositories..." />
    {/if}

    <!-- Error Alert -->
    {#if error}
        <ErrorAlert title="Import Failed" message={error} retry={handleImport} />
    {/if}

    <!-- Results -->
    {#if result}
        <Card>
            <CardHeader>
                <div class="flex items-center gap-2">
                    {#if result.failed === 0}
                        <CircleCheck class="h-5 w-5 text-green-600" />
                    {:else}
                        <CircleAlert class="h-5 w-5 text-orange-600" />
                    {/if}
                    <h2 class="text-lg font-semibold">Import Results</h2>
                </div>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    <!-- Summary -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="rounded-md bg-green-50 p-4">
                            <div class="text-2xl font-bold text-green-700">
                                {result.success}
                            </div>
                            <div class="text-sm text-green-600">Successfully imported</div>
                        </div>
                        <div
                            class="rounded-md p-4"
                            class:bg-red-50={result.failed > 0}
                            class:bg-slate-50={result.failed === 0}
                        >
                            <div
                                class="text-2xl font-bold"
                                class:text-red-700={result.failed > 0}
                                class:text-slate-600={result.failed === 0}
                            >
                                {result.failed}
                            </div>
                            <div
                                class="text-sm"
                                class:text-red-600={result.failed > 0}
                                class:text-slate-500={result.failed === 0}
                            >
                                Failed
                            </div>
                        </div>
                    </div>

                    <!-- Errors -->
                    {#if result.errors.length > 0}
                        <div>
                            <h3 class="mb-2 font-semibold text-slate-900">Errors:</h3>
                            <div class="space-y-2">
                                {#each result.errors as error}
                                    <div
                                        class="rounded-md border border-red-200 bg-red-50 p-3 text-sm"
                                    >
                                        <div class="font-medium text-red-900">
                                            Line {error.line}: {error.repo_url}
                                        </div>
                                        <div class="mt-1 text-red-700">{error.error}</div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Action Buttons -->
                    <div class="flex gap-3">
                        <Button onclick={() => goto("/repositories")}>
                            View Repositories
                        </Button>
                        <Button variant="outline" onclick={reset}>
                            Import More
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    {/if}
</div>
