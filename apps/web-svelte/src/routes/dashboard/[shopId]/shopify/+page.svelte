<script lang="ts">
    import { ArrowUp, ArrowDown, DollarSign, ShoppingBag, Users, Percent } from "lucide-svelte";

    let { data } = $props();
    let { stats, chartData, dateRange } = $derived(data);

    function formatCurrency(amount: number) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }

    function formatNumber(num: number) {
        return new Intl.NumberFormat('en-US').format(num);
    }
</script>

<div class="space-y-6">
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
                {#if chartData.length > 0}
                    {#each chartData as day}
                        <div class="flex-1 flex flex-col items-center group relative">
                            <div 
                                class="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-all"
                                style="height: {Math.max((day.revenue / Math.max(...chartData.map(d => d.revenue))) * 100, 5)}%"
                            ></div>
                            <!-- Tooltip -->
                            <div class="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                {day.date}: {formatCurrency(day.revenue)}
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
                {#if chartData.length > 0}
                    {#each chartData as day}
                        <div class="flex-1 flex flex-col items-center group relative">
                            <div 
                                class="w-full bg-blue-400 rounded-t hover:bg-blue-500 transition-all"
                                style="height: {Math.max((day.order_count / Math.max(...chartData.map(d => d.order_count))) * 100, 5)}%"
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

