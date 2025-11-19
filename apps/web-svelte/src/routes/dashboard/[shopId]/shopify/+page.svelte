<script lang="ts">
    import { DollarSign, ShoppingBag, Percent, Info } from "lucide-svelte";
    import { page } from "$app/stores";
    import type { SyncJob } from "@dashboard/config";
    import { JobStatus } from "@dashboard/config";

    const ACTIVE: JobStatus[] = [JobStatus.QUEUED, JobStatus.IN_PROGRESS];

    type ShopifyPoint = { date: string; revenue: number | null; order_count: number | null };

    let { data } = $props();
    let { stats, chartData, dateRange } = $derived(data);
    const chartPoints = $derived((chartData || []) as ShopifyPoint[]);
    const revenueMax = $derived(
        chartPoints.length ? Math.max(...chartPoints.map((point) => point.revenue || 0)) || 1 : 1,
    );
    const ordersMax = $derived(
        chartPoints.length ? Math.max(...chartPoints.map((point) => point.order_count || 0)) || 1 : 1,
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

    function formatNumber(num: number) {
        return new Intl.NumberFormat('en-US').format(num);
    }
</script>

<div class="space-y-6">
    {#if awaitingSeedData}
        <div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div class="flex items-start space-x-2">
                <Info class="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                    <p class="font-medium">Grabbing the latest Shopify orders</p>
                    <p class="text-xs opacity-80">
                        We’ll show the last few days of activity as soon as the seed sync finishes.
                    </p>
                </div>
            </div>
        </div>
    {:else if awaitingHistorical}
        <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <div class="flex items-start space-x-2">
                <Info class="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                    <p class="font-medium">Historical import working</p>
                    <p class="text-xs opacity-80">
                        Recent days are live. Older orders will continue to fill in over time.
                    </p>
                </div>
            </div>
        </div>
    {/if}
    <!-- KPI Cards -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Total Sales -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <DollarSign class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Total Sales</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatCurrency(stats.totalSales)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <!-- Total Orders -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <ShoppingBag class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Total Orders</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatNumber(stats.totalOrders)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <!-- AOV -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <div class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 text-gray-400 font-bold text-xs">
                            AOV
                        </div>
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Average Order Value</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatCurrency(stats.aov)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <!-- Conversion Rate -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <Percent class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Conversion Rate</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{stats.conversionRate.toFixed(2)}%</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- Revenue Over Time -->
        <div class="rounded-lg bg-white shadow p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 mb-4">Revenue Over Time</h3>
            <div class="h-64 flex items-end space-x-2">
                {#if chartPoints.length > 0}
                    {#each chartPoints as day (day.date)}
                        <div class="flex-1 flex flex-col items-center group relative">
                            <div 
                                class="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-all"
                                style="height: {Math.max((day.revenue || 0) / revenueMax * 100, 5)}%"
                            ></div>
                            <!-- Tooltip -->
                            <div class="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                {day.date}: {formatCurrency(day.revenue || 0)}
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

        <!-- Orders & Sessions -->
        <div class="rounded-lg bg-white shadow p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 mb-4">Orders</h3>
            <div class="h-64 flex items-end space-x-2">
                {#if chartPoints.length > 0}
                    {#each chartPoints as day (day.date)}
                        <div class="flex-1 flex flex-col items-center group relative">
                            <div 
                                class="w-full bg-blue-400 rounded-t hover:bg-blue-500 transition-all"
                                style="height: {Math.max((day.order_count || 0) / ordersMax * 100, 5)}%"
                            ></div>
                             <!-- Tooltip -->
                             <div class="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                {day.date}: {day.order_count} orders
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

    <!-- Tables Section -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- Top Products -->
        <div class="rounded-lg bg-white shadow">
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-base font-semibold leading-6 text-gray-900">Top Products by Revenue</h3>
            </div>
            <div class="p-6">
                <p class="text-sm text-gray-500 italic">Coming soon...</p>
            </div>
        </div>

        <!-- Channel Performance -->
        <div class="rounded-lg bg-white shadow">
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-base font-semibold leading-6 text-gray-900">Channel Performance</h3>
            </div>
            <div class="p-6">
                <p class="text-sm text-gray-500 italic">Coming soon...</p>
            </div>
        </div>
    </div>
</div>

