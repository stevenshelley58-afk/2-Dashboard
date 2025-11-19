<script lang="ts">
    import { DollarSign, MousePointer, Eye, TrendingUp } from "lucide-svelte";

    type MetaPoint = { date: string; spend: number | null; revenue: number | null };

    let { data } = $props();
    let { stats, chartData, dateRange } = $derived(data);
    const chartPoints = $derived((chartData || []) as MetaPoint[]);
    const revenueMax = $derived(
        chartPoints.length ? Math.max(...chartPoints.map((point) => point.revenue || 0)) || 1 : 1,
    );
    const spendMax = $derived(
        chartPoints.length ? Math.max(...chartPoints.map((point) => point.spend || 0)) || 1 : 1,
    );

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
        <!-- Spend -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <DollarSign class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Ad Spend</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatCurrency(stats.spend)}</div>
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

        <!-- Impressions -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <Eye class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Impressions</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatNumber(stats.impressions)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>

        <!-- Clicks -->
        <div class="overflow-hidden rounded-lg bg-white shadow">
            <div class="p-5">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <MousePointer class="h-6 w-6 text-gray-400" />
                    </div>
                    <div class="ml-5 w-0 flex-1">
                        <dl>
                            <dt class="truncate text-sm font-medium text-gray-500">Clicks</dt>
                            <dd>
                                <div class="text-lg font-medium text-gray-900">{formatNumber(stats.clicks)}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <!-- Spend vs Revenue -->
        <div class="rounded-lg bg-white shadow p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 mb-4">Spend vs Revenue</h3>
            <div class="h-64 flex items-end space-x-2">
                {#if chartPoints.length > 0}
                    {#each chartPoints as day (day.date)}
                        <div class="flex-1 flex flex-col items-center group relative space-y-1">
                            <!-- Revenue Bar -->
                            <div 
                                class="w-full bg-green-400 rounded-t hover:bg-green-500 transition-all opacity-80"
                                style="height: {Math.max((day.revenue || 0) / revenueMax * 50, 2)}%"
                            ></div>
                            <!-- Spend Bar -->
                            <div 
                                class="w-full bg-red-400 rounded-t hover:bg-red-500 transition-all opacity-80"
                                style="height: {Math.max((day.spend || 0) / spendMax * 50, 2)}%"
                            ></div>
                            
                            <!-- Tooltip -->
                            <div class="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                {day.date}<br>
                                Rev: {formatCurrency(day.revenue || 0)}<br>
                                Spend: {formatCurrency(day.spend || 0)}
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

