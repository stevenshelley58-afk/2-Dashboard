<script lang="ts">
    import SyncStatus from "$lib/components/SyncStatus.svelte";
    let { children, data } = $props();
    let { sync } = $derived(data);
</script>

<div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-gray-900">Shop Overview</h1>
    <SyncStatus jobs={sync?.jobs} cursors={sync?.cursors} />
</div>

{@render children()}
