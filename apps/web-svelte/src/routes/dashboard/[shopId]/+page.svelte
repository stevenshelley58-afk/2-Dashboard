<script lang="ts">
    let { data } = $props();
    let { shopId, metrics } = $derived(data);
</script>

<div class="px-4 sm:px-0">
    <h3 class="text-base font-semibold leading-7 text-gray-900">Dashboard</h3>
    <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
        Overview for shop {shopId} (Last 30 Days)
    </p>
</div>

<div class="mt-6 border-t border-gray-100">
    <dl class="divide-y divide-gray-100">
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">Revenue</dt>
            <dd
                class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0"
            >
                ${metrics.revenue.toFixed(2)}
            </dd>
        </div>
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">Spend</dt>
            <dd
                class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0"
            >
                ${metrics.spend.toFixed(2)}
            </dd>
        </div>
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">MER</dt>
            <dd
                class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0"
            >
                {metrics.mer.toFixed(2)}
            </dd>
        </div>
        <div class="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt class="text-sm font-medium leading-6 text-gray-900">ROAS</dt>
            <dd
                class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0"
            >
                {metrics.roas.toFixed(2)}
            </dd>
        </div>
    </dl>
</div>
