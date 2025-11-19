<script lang="ts">
    import { page } from "$app/stores";
    import ShopSelector from "$lib/components/ShopSelector.svelte";
    import SyncStatus from "$lib/components/SyncStatus.svelte";
    import DateRangePicker from "$lib/components/DateRangePicker.svelte";
    import { Home, ShoppingBag, Megaphone, Settings, Menu, X } from "lucide-svelte";

    let { children, data } = $props();
    let { sync, shops } = $derived(data);
    let shopId = $derived($page.params.shopId);

    let isSidebarOpen = $state(false);

    const navigation = [
        { name: 'Home', href: `/dashboard/${shopId}`, icon: Home, exact: true },
        { name: 'Shopify', href: `/dashboard/${shopId}/shopify`, icon: ShoppingBag, exact: false },
        { name: 'Meta', href: `/dashboard/${shopId}/meta`, icon: Megaphone, exact: false },
        { name: 'Settings', href: `/dashboard/${shopId}/settings`, icon: Settings, exact: false },
    ];

    function isCurrent(nav: typeof navigation[0]) {
        if (nav.exact) {
            return $page.url.pathname === nav.href;
        }
        return $page.url.pathname.startsWith(nav.href);
    }
</script>

<div class="min-h-screen bg-gray-50 flex">
    <!-- Mobile sidebar backdrop -->
    {#if isSidebarOpen}
        <div class="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden" onclick={() => isSidebarOpen = false} role="presentation"></div>
    {/if}

    <!-- Sidebar -->
    <div class={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:flex lg:flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div class="flex h-16 flex-shrink-0 items-center px-4 border-b border-gray-200">
            <span class="text-xl font-bold text-indigo-600">Dashboard</span>
        </div>
        
        <div class="p-4 border-b border-gray-200">
            <label for="shop-select" class="block text-xs font-medium text-gray-500 mb-1">Current Shop</label>
            <ShopSelector {shops} />
        </div>

        <div class="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <nav class="mt-1 space-y-1 px-2">
                {#each navigation as nav}
                    <a
                        href={nav.href}
                        class={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                            isCurrent(nav)
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <nav.icon
                            class={`mr-3 h-5 w-5 flex-shrink-0 ${
                                isCurrent(nav) ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                            }`}
                        />
                        {nav.name}
                    </a>
                {/each}
            </nav>
        </div>
        
        <div class="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div class="flex-shrink-0 w-full group block">
                <div class="flex items-center">
                    <div class="ml-3">
                        <p class="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                            {data.session?.user?.email}
                        </p>
                        <form action="/logout" method="POST" class="mt-1">
                            <button type="submit" class="text-xs font-medium text-gray-500 hover:text-gray-700">
                                Sign out
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main content -->
    <div class="flex flex-1 flex-col min-w-0 overflow-hidden">
        <!-- Top header -->
        <div class="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
            <div class="flex items-center">
                <button
                    type="button"
                    class="lg:hidden -ml-2 mr-2 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                    onclick={() => isSidebarOpen = true}
                >
                    <span class="sr-only">Open sidebar</span>
                    <Menu class="h-6 w-6" />
                </button>
                <h1 class="text-2xl font-semibold text-gray-900">
                    {#if $page.url.pathname.includes('/shopify')}
                        Shopify Performance
                    {:else if $page.url.pathname.includes('/meta')}
                        Meta Performance
                    {:else if $page.url.pathname.includes('/settings')}
                        Settings
                    {:else}
                        Overview
                    {/if}
                </h1>
            </div>
            <div class="flex items-center space-x-4">
                <DateRangePicker />
                <div class="hidden sm:block">
                    <SyncStatus jobs={sync?.jobs} cursors={sync?.cursors} />
                </div>
            </div>
        </div>

        <!-- Content area -->
        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {@render children()}
        </main>
    </div>
</div>
