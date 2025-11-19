<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { onMount } from "svelte";

    let isOpen = $state(false);
    let selectedRange = $state("Today");
    
    // Get dates from URL or default to Today
    let fromDate = $state("");
    let toDate = $state("");

    const ranges = [
        { label: "Today", value: "today" },
        { label: "Yesterday", value: "yesterday" },
        { label: "Last 7 days", value: "last_7" },
        { label: "Last 30 days", value: "last_30" },
        { label: "This Month", value: "this_month" },
        { label: "Last Month", value: "last_month" },
    ];

    function formatDate(date: Date) {
        return date.toISOString().split('T')[0];
    }

    function applyRange(range: string) {
        const end = new Date();
        let start = new Date();

        switch (range) {
            case "today":
                break; // start is today
            case "yesterday":
                start.setDate(end.getDate() - 1);
                end.setDate(end.getDate() - 1);
                break;
            case "last_7":
                start.setDate(end.getDate() - 6);
                break;
            case "last_30":
                start.setDate(end.getDate() - 29);
                break;
            case "this_month":
                start.setDate(1);
                break;
            case "last_month":
                start.setMonth(start.getMonth() - 1);
                start.setDate(1);
                end.setDate(0); // Last day of previous month
                break;
        }

        fromDate = formatDate(start);
        toDate = formatDate(end);
        selectedRange = ranges.find(r => r.value === range)?.label || "Custom";
        updateUrl();
        isOpen = false;
    }

    function updateUrl() {
        const url = new URL($page.url);
        url.searchParams.set("from", fromDate);
        url.searchParams.set("to", toDate);
        goto(url, { keepFocus: true, noScroll: true });
    }

    onMount(() => {
        const from = $page.url.searchParams.get("from");
        const to = $page.url.searchParams.get("to");
        if (from && to) {
            fromDate = from;
            toDate = to;
            selectedRange = "Custom";
            // Try to match with presets
            // (Logic omitted for brevity, keeps "Custom" if loaded from URL)
        } else {
            applyRange("today");
        }
    });
</script>

<div class="relative inline-block text-left">
    <div class="flex items-center space-x-2 bg-white rounded-md shadow-sm border border-gray-300 px-3 py-2">
        <button 
            type="button" 
            class="text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
            onclick={() => isOpen = !isOpen}
        >
            {selectedRange}
        </button>
        <span class="text-gray-400">|</span>
        <span class="text-sm text-gray-500">{fromDate} - {toDate}</span>
    </div>

    {#if isOpen}
        <div class="absolute right-0 mt-2 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
            <div class="p-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Presets</h3>
                        {#each ranges as range}
                            <button
                                class="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded"
                                onclick={() => applyRange(range.value)}
                            >
                                {range.label}
                            </button>
                        {/each}
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Custom</h3>
                        <div>
                            <label for="from" class="block text-xs text-gray-500">From</label>
                            <input 
                                type="date" 
                                id="from"
                                bind:value={fromDate} 
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs"
                            />
                        </div>
                        <div>
                            <label for="to" class="block text-xs text-gray-500">To</label>
                            <input 
                                type="date" 
                                id="to"
                                bind:value={toDate} 
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs"
                            />
                        </div>
                        <button
                            class="w-full mt-2 bg-indigo-600 text-white px-2 py-1 rounded text-sm hover:bg-indigo-700"
                            onclick={() => {
                                selectedRange = "Custom";
                                updateUrl();
                                isOpen = false;
                            }}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

