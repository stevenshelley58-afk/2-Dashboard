<script lang="ts">
    import ShopSelector from "$lib/components/ShopSelector.svelte";
    import { page } from "$app/stores";

    let { children, data } = $props();
    let { shops, session } = $derived(data);
</script>

<div class="min-h-screen bg-gray-100">
    <nav class="bg-white shadow-sm">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div class="flex h-16 justify-between">
                <div class="flex">
                    <div class="flex flex-shrink-0 items-center">
                        <span class="text-xl font-bold text-indigo-600"
                            >Dashboard</span
                        >
                    </div>
                    <div class="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                        <a
                            href="/dashboard"
                            class="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            aria-current={$page.url.pathname === "/dashboard"
                                ? "page"
                                : undefined}
                        >
                            Overview
                        </a>
                    </div>
                </div>
                <div class="flex items-center">
                    <div class="mr-4 w-48">
                        <ShopSelector {shops} />
                    </div>
                    <div class="ml-3 relative">
                        <div class="flex items-center">
                            <span class="text-sm text-gray-500 mr-2"
                                >{session?.user?.email}</span
                            >
                            <form action="/logout" method="POST">
                                <button
                                    type="submit"
                                    class="text-sm font-medium text-gray-500 hover:text-gray-700"
                                    >Sign out</button
                                >
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <div class="py-10">
        <main>
            <div class="mx-auto max-w-7xl sm:px-6 lg:px-8">
                {@render children()}
            </div>
        </main>
    </div>
</div>
