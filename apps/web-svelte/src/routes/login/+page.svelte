<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import type { SubmitFunction } from "@sveltejs/kit";

    let loading = $state(false);
    let message = $state("");

    const handleLogin: SubmitFunction = () => {
        loading = true;
        return async ({ result }) => {
            loading = false;
            if (result.type === "redirect") {
                goto(result.location);
            } else if (result.type === "error") {
                message = result.error.message;
            } else if (result.type === "failure") {
                message = result.data?.message as string;
            }
        };
    };
</script>

<div
    class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8"
>
    <div class="w-full max-w-md space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Sign in to your account
            </h2>
        </div>
        <form
            class="mt-8 space-y-6"
            method="POST"
            action="?/login"
            use:enhance={handleLogin}
        >
            <div class="-space-y-px rounded-md shadow-sm">
                <div>
                    <label for="email" class="sr-only">Email address</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autocomplete="email"
                        required
                        class="relative block w-full appearance-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        placeholder="Email address"
                    />
                </div>
                <div>
                    <label for="password" class="sr-only">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autocomplete="current-password"
                        required
                        class="relative block w-full appearance-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        placeholder="Password"
                    />
                </div>
            </div>

            <div>
                <button
                    type="submit"
                    disabled={loading}
                    class="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                    {#if loading}
                        Signing in...
                    {:else}
                        Sign in
                    {/if}
                </button>
            </div>
            {#if message}
                <div class="text-center text-sm text-red-600">{message}</div>
            {/if}
        </form>
    </div>
</div>
