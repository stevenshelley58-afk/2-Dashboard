<script lang="ts">
    import { enhance } from "$app/forms";
    import type { SubmitFunction } from "@sveltejs/kit";
    import { Eye, EyeOff } from "lucide-svelte";

    let loading = $state(false);
    let message = $state("");
    let showToken = $state(false);

    const handleSubmit: SubmitFunction = () => {
        loading = true;
        return async ({ result }) => {
            loading = false;
            if (result.type === "error") {
                message = result.error.message;
            } else if (result.type === "failure") {
                message = result.data?.message as string;
            }
        };
    };
</script>

<div class="mx-auto max-w-2xl px-4 py-8">
    <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Connect a Shopify Store</h1>
        <p class="mt-2 text-gray-600">
            Enter your Shopify store details and Admin API access token.
        </p>
    </div>

    <form
        method="POST"
        action="?/create"
        use:enhance={handleSubmit}
        class="space-y-6 rounded-lg bg-white p-6 shadow"
    >
        <div>
            <label for="name" class="block text-sm font-medium text-gray-700">
                Shop Name
            </label>
            <input
                type="text"
                name="name"
                id="name"
                required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="My Awesome Store"
            />
        </div>

        <div>
            <label for="domain" class="block text-sm font-medium text-gray-700">
                Shopify Domain
            </label>
            <div class="mt-1 flex rounded-md shadow-sm">
                <input
                    type="text"
                    name="domain"
                    id="domain"
                    required
                    class="block w-full min-w-0 flex-1 rounded-none rounded-l-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="my-store"
                />
                <span
                    class="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm"
                >
                    .myshopify.com
                </span>
            </div>
        </div>

        <div>
            <label for="token" class="block text-sm font-medium text-gray-700">
                Admin Access Token
            </label>
            <div class="relative mt-1 rounded-md shadow-sm">
                <input
                    type={showToken ? "text" : "password"}
                    name="token"
                    id="token"
                    required
                    class="block w-full rounded-md border-gray-300 pr-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="shpat_..."
                />
                <button
                    type="button"
                    class="absolute inset-y-0 right-0 flex items-center pr-3"
                    onclick={() => showToken = !showToken}
                >
                    {#if showToken}
                        <EyeOff class="h-5 w-5 text-gray-400" aria-hidden="true" />
                    {:else}
                        <Eye class="h-5 w-5 text-gray-400" aria-hidden="true" />
                    {/if}
                </button>
            </div>
            <p class="mt-1 text-xs text-gray-500">
                Must have read_orders, read_products, read_customers scopes.
            </p>
        </div>

        <div class="pt-4">
            <button
                type="submit"
                disabled={loading}
                class="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
                {#if loading}
                    Connecting...
                {:else}
                    Connect Store
                {/if}
            </button>
        </div>

        {#if message}
            <div class="rounded-md bg-red-50 p-4">
                <div class="flex">
                    <div class="ml-3">
                        <h3 class="text-sm font-medium text-red-800">
                            Error connecting store
                        </h3>
                        <div class="mt-2 text-sm text-red-700">
                            <p>{message}</p>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </form>
</div>
