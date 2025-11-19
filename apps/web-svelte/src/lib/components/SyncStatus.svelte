<script lang="ts">
    import type { SyncJob, SyncCursor } from "@dashboard/config";
    import { JobStatus } from "@dashboard/config";

    const ACTIVE: JobStatus[] = [JobStatus.QUEUED, JobStatus.IN_PROGRESS];

    type Banner = {
        tone: "info" | "success" | "error";
        title: string;
        description?: string;
    };

    let { jobs = [], cursors = [] }: { jobs?: SyncJob[]; cursors?: SyncCursor[] } = $props();

    const shopifyCursor = $derived(
        (cursors || []).find((cursor) => cursor.platform === "SHOPIFY"),
    );
    const shopifyJobs = $derived((jobs || []).filter((job) => job.platform === "SHOPIFY"));
    const incrementalJob = $derived(
        shopifyJobs.find((job) => job.job_type === "INCREMENTAL"),
    );
    const historicalJob = $derived(
        shopifyJobs.find((job) => job.job_type === "HISTORICAL_INIT"),
    );

    const banners = $derived((() => {
        const notices: Banner[] = [];
        if (incrementalJob && ACTIVE.includes(incrementalJob.status)) {
            notices.push({
                tone: "info",
                title: "Seeding recent Shopify data",
                description: "Importing the last few days so you can start exploring immediately.",
            });
        } else if (incrementalJob?.status === "FAILED") {
            notices.push({
                tone: "error",
                title: "Recent sync failed",
                description: "Check logs or retry the sync job.",
            });
        }

        if (
            !incrementalJob ||
            (!ACTIVE.includes(incrementalJob.status) && historicalJob && ACTIVE.includes(historicalJob.status))
        ) {
            notices.push({
                tone: "info",
                title: "Historical backfill running",
                description: "We’re downloading the full Shopify history in the background.",
            });
        } else if (historicalJob?.status === "FAILED") {
            notices.push({
                tone: "error",
                title: "Historical sync failed",
                description: "Retry the job from the Sync tab to continue the backfill.",
            });
        } else if (
            incrementalJob?.status === "SUCCEEDED" &&
            historicalJob?.status === "SUCCEEDED"
        ) {
            notices.push({
                tone: "success",
                title: "Historical data ready",
                description: shopifyCursor?.last_success_at
                    ? `Last refresh ${new Date(shopifyCursor.last_success_at).toLocaleString()}`
                    : undefined,
            });
        }

        if (notices.length === 0 && shopifyCursor?.last_success_at) {
            notices.push({
                tone: "success",
                title: "Sync healthy",
                description: `Last refresh ${new Date(
                    shopifyCursor.last_success_at,
                ).toLocaleString()}`,
            });
        } else if (notices.length === 0) {
            notices.push({
                tone: "info",
                title: "Sync not started",
                description: "Connect a platform to populate your dashboard.",
            });
        }

        return notices;
    })());

    const toneClasses: Record<Banner["tone"], string> = {
        info: "border-blue-200 bg-blue-50 text-blue-900",
        success: "border-green-200 bg-green-50 text-green-900",
        error: "border-red-200 bg-red-50 text-red-900",
    };
</script>

<div class="flex flex-col space-y-2 text-xs sm:text-sm">
    {#each banners as banner}
        <div class={`rounded-md border px-3 py-2 ${toneClasses[banner.tone]}`}>
            <div class="font-medium">{banner.title}</div>
            {#if banner.description}
                <div class="text-[11px] sm:text-xs opacity-80">{banner.description}</div>
            {/if}
        </div>
    {/each}
</div>
