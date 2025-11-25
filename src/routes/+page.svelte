<script lang="ts">
    import Button from '$lib/components/ui/button.svelte';
</script>

<div class="container mx-auto p-8">
    <h1 class="text-4xl font-bold mb-4">Welcome to SvelteKit</h1>
    <p class="mb-4">Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
    
    <div class="flex gap-4">
        <Button>Default Button</Button>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="outline">Outline Button</Button>
    </div>
</div>
