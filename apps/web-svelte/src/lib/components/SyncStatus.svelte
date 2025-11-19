<script lang="ts">
    let { jobs, cursors } = $props();

    let lastJob = $derived(jobs?.[0]);
    let status = $derived(lastJob?.status || "UNKNOWN");
    let lastSuccess = $derived(
        cursors?.find((c: any) => c.platform === "SHOPIFY")?.last_success_at,
    );
</script>

<div class="flex items-center space-x-2 text-sm">
    <span class="text-gray-500">Sync Status:</span>
    {#if status === "IN_PROGRESS"}
        <span
            class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
        >
            Syncing...
        </span>
    {:else if status === "SUCCEEDED"}
        <span
            class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
        >
            Healthy
        </span>
        {#if lastSuccess}
            <span class="text-xs text-gray-400"
                >Last sync: {new Date(lastSuccess).toLocaleString()}</span
            >
        {/if}
    {:else if status === "FAILED"}
        <span
            class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
        >
            Error
        </span>
        {#if lastJob?.error}
            <span
                class="text-xs text-red-500"
                title={JSON.stringify(lastJob.error)}>View Error</span
            >
        {/if}
    {:else}
        <span class="text-gray-400">Unknown</span>
    {/if}
</div>
