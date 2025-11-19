<script lang="ts">
    import { DollarSign, TrendingUp, PieChart, Activity, Info } from "lucide-svelte";
    import { page } from "$app/stores";
    import type { SyncJob } from "@dashboard/config";
    import { JobStatus } from "@dashboard/config";

    const ACTIVE: JobStatus[] = [JobStatus.QUEUED, JobStatus.IN_PROGRESS];

    type OverviewPoint = {
        date: string;
        revenue: number | null;
        total_spend: number | null;
        mer: number | null;
    };

    let { data } = $props();
    let { stats, chartData, dateRange } = $derived(data);
    const chartPoints = $derived((chartData || []) as OverviewPoint[]);
    const revenueMax = $derived(
        chartPoints.length ? Math.max(...chartPoints.map((point) => point.revenue || 0)) || 1 : 1,
    );
    const spendMax = $derived(
        chartPoints.length ? Math.max(...chartPoints.map((point) => point.total_spend || 0)) || 1 : 1,
    );
    const sync = $derived($page.data.sync);
    const shopifyJobs = $derived(((sync?.jobs || []) as SyncJob[]).filter((job) => job.platform === "SHOPIFY"));
    const seedJob = $derived(
        shopifyJobs.find((job) => job.job_type === "INCREMENTAL"),
    );
    const historicalJob = $derived(
        shopifyJobs.find((job) => job.job_type === "HISTORICAL_INIT"),
    );
    const awaitingSeedData = $derived(
        seedJob && ACTIVE.includes(seedJob.status) && chartPoints.length === 0,
    );
    const awaitingHistorical = $derived(
        !awaitingSeedData && historicalJob && ACTIVE.includes(historicalJob.status),
    );

    function formatCurrency(amount: number) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
</script>

<div class="space-y-6">
{#if awaitingSeedData}
        <div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div class="flex items-start space-x-2">
                <Info class="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                    <p class="font-medium">Importing recent Shopify data</p>
                    <p class="text-xs opacity-80">
                        We’ll populate the dashboard as soon as the first seed sync finishes (typically a few minutes).
                    </p>
                </div>
            </div>
        </div>
    {:else if awaitingHistorical}
        <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <div class="flex items-start space-x-2">
                <Info class="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                    <p class="font-medium">Historical backfill running</p>
                    <p class="text-xs opacity-80">Recent days are live. Older orders will roll in shortly.</p>
                </div>
            </div>
        </div>
    {/if}
    <!-- KPI Cards -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Revenue -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <DollarSign class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Total Revenue</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatCurrency(stats.revenue)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <!-- Spend -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <PieChart class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Total Spend</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatCurrency(stats.spend)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <!-- MER -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <Activity class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">MER</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{stats.mer.toFixed(2)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <!-- ROAS -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <TrendingUp class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">ROAS</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{stats.roas.toFixed(2)}x</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- Revenue vs Spend -->
        <div class="rounded-lg bg-white shadow p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 mb-4">Revenue vs Spend</h3>
            <div class="h-64 flex items-end space-x-2">
                {#if chartPoints.length > 0}
                    {#each chartPoints as day (day.date)}
                        <div class="flex-1 flex flex-col items-center group relative space-y-1">
                            <!-- Revenue Bar -->
                            <div 
                                class="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-all opacity-80"
                                style="height: {Math.max((day.revenue || 0) / revenueMax * 50, 2)}%"
                            ></div>
                            <!-- Spend Bar -->
                            <div 
                                class="w-full bg-pink-400 rounded-t hover:bg-pink-500 transition-all opacity-80"
                                style="height: {Math.max((day.total_spend || 0) / spendMax * 50, 2)}%"
                            ></div>
                            
                            <!-- Tooltip -->
                            <div class="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                {day.date}<br>
                                Rev: {formatCurrency(day.revenue || 0)}<br>
                                Spend: {formatCurrency(day.total_spend || 0)}
                            </div>
                        </div>
                    {/each}
                {:else}
                    <div class="w-full h-full flex items-center justify-center text-gray-400">
                        No data for selected period
                    </div>
                {/if}
            </div>
            <div class="mt-2 flex justify-between text-xs text-gray-500">
                <span>{dateRange.from}</span>
                <span>{dateRange.to}</span>
            </div>
        </div>
    </div>
</div>
