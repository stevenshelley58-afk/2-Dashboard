<script lang="ts">
    import { enhance, applyAction } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import type { SubmitFunction } from "@sveltejs/kit";
    import { page } from "$app/stores";
    import {
        KeyRound,
        RefreshCw,
        Clock3,
        AlertTriangle,
        CheckCircle2,
        Shield,
        PlugZap,
    } from "lucide-svelte";
    import type { SyncCursor, SyncJob } from "@dashboard/config";
    import { Platform, JobStatus } from "@dashboard/config";

    let { data, form } = $props();

    type CredentialSummary = {
        id: string;
        platform: Platform;
        metadata: Record<string, unknown>;
        created_at: string;
        updated_at: string;
        tokenPreview: string | null;
        hasToken: boolean;
    };

    const sync = $derived($page.data.sync);
    const credentials = $derived((data.credentials || []) as CredentialSummary[]);
    const credentialsByPlatform = $derived(
        (() => {
            const map: Partial<Record<Platform, CredentialSummary>> = {};
            for (const cred of credentials) {
                map[cred.platform] = cred;
            }
            return map;
        })(),
    );

    const cursorsByPlatform = $derived(
        (() => {
            const map: Partial<Record<Platform, SyncCursor>> = {};
            for (const cursor of ((sync?.cursors || []) as SyncCursor[])) {
                map[cursor.platform] = cursor;
            }
            return map;
        })(),
    );

    const jobsByPlatform = $derived(
        (() => {
            const map: Partial<Record<Platform, SyncJob | undefined>> = {};
            for (const platform of Object.values(Platform)) {
                const job = ((sync?.jobs || []) as SyncJob[]).find((item) => item.platform === platform);
                map[platform] = job;
            }
            return map;
        })(),
    );

    const shopifyCred = $derived(credentialsByPlatform[Platform.SHOPIFY]);
    const metaCred = $derived(credentialsByPlatform[Platform.META]);
    const shopifyCursor = $derived(cursorsByPlatform[Platform.SHOPIFY]);
    const metaCursor = $derived(cursorsByPlatform[Platform.META]);
    const shopifyJob = $derived(jobsByPlatform[Platform.SHOPIFY]);
    const metaJob = $derived(jobsByPlatform[Platform.META]);
    const shopifyConnected = $derived(Boolean(shopifyCred?.hasToken));
    const metaConnected = $derived(Boolean(metaCred?.hasToken));
    const metaAccountFromServer = $derived(
        (metaCred?.metadata?.["ad_account_id"] as string | undefined) ?? "",
    );

    let shopifyDomain = $state((data.shop?.shopify_domain || "").replace(".myshopify.com", ""));
    let lastShopifyDomain = data.shop?.shopify_domain || "";
    $effect(() => {
        const currentDomain = data.shop?.shopify_domain || "";
        if (currentDomain && currentDomain !== lastShopifyDomain) {
            lastShopifyDomain = currentDomain;
            shopifyDomain = currentDomain.replace(".myshopify.com", "");
        }
    });

    let metaAdAccount = $state("");
    let lastMetaAccount = "";
    $effect(() => {
        const currentAccount = metaAccountFromServer;
        if (currentAccount !== lastMetaAccount) {
            lastMetaAccount = currentAccount;
            metaAdAccount = currentAccount.replace(/^act_/, "");
        }
    });

    let shopifyToken = $state("");
    let metaToken = $state("");
    let showShopifyToken = $state(false);
    let showMetaToken = $state(false);

    const saving = $state<{ shopify: boolean; meta: boolean }>({ shopify: false, meta: false });

    const handleSubmit = (key: "shopify" | "meta"): SubmitFunction => {
        return () => {
            saving[key] = true;
            return async ({ result }) => {
                saving[key] = false;
                if (result.type === "redirect") {
                    return;
                }
                await applyAction(result);
                if (result.type === "success") {
                    if (key === "shopify") {
                        shopifyToken = "";
                    } else {
                        metaToken = "";
                    }
                    await invalidateAll();
                }
            };
        };
    };

    function formatTimestamp(value?: string | null) {
        if (!value) return "Never";
        return new Date(value).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
    }

    function statusTone(connected: boolean) {
        return connected
            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
            : "text-amber-700 bg-amber-50 border-amber-200";
    }

    function jobStatusCopy(status?: JobStatus) {
        if (!status) return "No runs yet";
        switch (status) {
            case JobStatus.SUCCEEDED:
                return "Last run succeeded";
            case JobStatus.IN_PROGRESS:
                return "Sync running now";
            case JobStatus.QUEUED:
                return "Sync queued";
            case JobStatus.FAILED:
                return "Last run failed";
            default:
                return status;
        }
    }

    const formMessage = (target: "shopify" | "meta") => (form?.target === target ? form?.message : null);
    const formIsSuccess = (target: "shopify" | "meta") => form?.target === target && form?.ok;
    const formIsError = (target: "shopify" | "meta") => form?.target === target && form?.ok === false;
</script>

<div class="space-y-8">
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="px-6 py-6">
            <div class="flex items-center gap-3">
                <Shield class="h-5 w-5 text-indigo-500" />
                <div>
                    <h1 class="text-lg font-semibold text-slate-900">API keys & integrations</h1>
                    <p class="text-sm text-slate-600">
                        Rotate tokens safely, see when data last flowed, and keep your syncs healthy.
                    </p>
                </div>
            </div>
            <div class="mt-5 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <div class="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <CheckCircle2 class="mt-0.5 h-4 w-4 text-emerald-500" />
                    <div>
                        <p class="font-medium text-slate-900">Editable credentials</p>
                        <p>Rotate Shopify + Meta keys anytime without waiting on support.</p>
                    </div>
                </div>
                <div class="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <RefreshCw class="mt-0.5 h-4 w-4 text-indigo-500" />
                    <div>
                        <p class="font-medium text-slate-900">Sync telemetry</p>
                        <p>See last data received, the most recent attempt, and current job status.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="space-y-6">
        <article class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                    <p class="text-sm font-semibold text-slate-900">Shopify</p>
                    <p class="text-sm text-slate-500">Orders, customers, refunds</p>
                </div>
                <span
                    class={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                        shopifyConnected,
                    )}`}
                >
                    {shopifyConnected ? "Connected" : "Not connected"}
                </span>
            </div>

            <div class="grid gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5 text-sm text-slate-600 md:grid-cols-3">
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <RefreshCw class="mt-0.5 h-4 w-4 text-indigo-500" />
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Last data received</p>
                        <p class="font-semibold text-slate-900">{formatTimestamp(shopifyCursor?.last_success_at)}</p>
                    </div>
                </div>
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <Clock3 class="mt-0.5 h-4 w-4 text-indigo-500" />
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Last sync attempt</p>
                        <p class="font-semibold text-slate-900">
                            {formatTimestamp(shopifyJob?.started_at || shopifyJob?.created_at)}
                        </p>
                    </div>
                </div>
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <KeyRound class="mt-0.5 h-4 w-4 text-indigo-500" />
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Last result</p>
                        <p class="font-semibold text-slate-900">{jobStatusCopy(shopifyJob?.status)}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-5 px-6 py-6">
                {#if formMessage("shopify")}
                    <div
                        class={`rounded-md border px-4 py-3 text-sm ${formIsSuccess("shopify")
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : formIsError("shopify")
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-slate-200 bg-slate-50 text-slate-700"}`}
                    >
                        {formMessage("shopify")}
                    </div>
                {/if}

                <form
                    method="POST"
                    action="?/shopify"
                    use:enhance={handleSubmit("shopify")}
                    class="space-y-5"
                >
                    <div>
                        <label class="text-sm font-medium text-slate-900" for="shopify-domain">Shopify domain</label>
                        <div class="mt-1 flex rounded-md shadow-sm">
                            <input
                                type="text"
                                name="shopify_domain"
                                bind:value={shopifyDomain}
                                required
                                id="shopify-domain"
                                class="block w-full rounded-l-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="my-store"
                            />
                            <span class="inline-flex items-center rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                                .myshopify.com
                            </span>
                        </div>
                    </div>

                    <div>
                        <label class="text-sm font-medium text-slate-900" for="shopify-token">Admin API access token</label>
                        <div class="relative mt-1 rounded-md shadow-sm">
                            <input
                                type={showShopifyToken ? "text" : "password"}
                                name="shopify_token"
                                bind:value={shopifyToken}
                                required
                                autocomplete="off"
                                id="shopify-token"
                                class="block w-full rounded-md border border-slate-300 px-3 py-2 pr-12 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="shpat_..."
                            />
                            <button
                                type="button"
                                class="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-slate-500"
                                onclick={() => (showShopifyToken = !showShopifyToken)}
                            >
                                {showShopifyToken ? "Hide" : "Show"}
                            </button>
                        </div>
                        <p class="mt-1 text-xs text-slate-500">
                            Needs read_orders, read_products, read_customers scopes.
                        </p>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                            Stored token: {shopifyCred?.tokenPreview ?? "Not set"}
                        </span>
                        <span>Updated {formatTimestamp(shopifyCred?.updated_at)}</span>
                    </div>

                    <div class="flex justify-end">
                        <button
                            type="submit"
                            class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={saving.shopify}
                        >
                            {saving.shopify ? "Saving…" : "Save Shopify key"}
                        </button>
                    </div>
                </form>
            </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                    <p class="text-sm font-semibold text-slate-900">Meta Ads</p>
                    <p class="text-sm text-slate-500">Spend, campaigns, and MER</p>
                </div>
                <span
                    class={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                        metaConnected,
                    )}`}
                >
                    {metaConnected ? "Connected" : "Not connected"}
                </span>
            </div>

            <div class="grid gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5 text-sm text-slate-600 md:grid-cols-3">
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <RefreshCw class="mt-0.5 h-4 w-4 text-indigo-500" />
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Last data received</p>
                        <p class="font-semibold text-slate-900">{formatTimestamp(metaCursor?.last_success_at)}</p>
                    </div>
                </div>
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <Clock3 class="mt-0.5 h-4 w-4 text-indigo-500" />
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Last sync attempt</p>
                        <p class="font-semibold text-slate-900">
                            {formatTimestamp(metaJob?.started_at || metaJob?.created_at)}
                        </p>
                    </div>
                </div>
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <AlertTriangle class="mt-0.5 h-4 w-4 text-indigo-500" />
                    <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500">Last result</p>
                        <p class="font-semibold text-slate-900">{jobStatusCopy(metaJob?.status)}</p>
                    </div>
                </div>
            </div>

            <div class="space-y-5 px-6 py-6">
                {#if formMessage("meta")}
                    <div
                        class={`rounded-md border px-4 py-3 text-sm ${formIsSuccess("meta")
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : formIsError("meta")
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-slate-200 bg-slate-50 text-slate-700"}`}
                    >
                        {formMessage("meta")}
                    </div>
                {/if}

                <form method="POST" action="?/meta" use:enhance={handleSubmit("meta")} class="space-y-5">
                    <div>
                        <label class="text-sm font-medium text-slate-900" for="meta-account">Ad account ID</label>
                        <div class="mt-1 flex rounded-md shadow-sm">
                            <span class="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                                act_
                            </span>
                            <input
                                type="text"
                                name="meta_account"
                                bind:value={metaAdAccount}
                                required
                                id="meta-account"
                                class="block w-full rounded-r-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="1234567890"
                            />
                        </div>
                    </div>

                    <div>
                        <label class="text-sm font-medium text-slate-900" for="meta-token">System user token</label>
                        <div class="relative mt-1 rounded-md shadow-sm">
                            <input
                                type={showMetaToken ? "text" : "password"}
                                name="meta_token"
                                bind:value={metaToken}
                                required
                                autocomplete="off"
                                id="meta-token"
                                class="block w-full rounded-md border border-slate-300 px-3 py-2 pr-12 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="EAAG..."
                            />
                            <button
                                type="button"
                                class="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-slate-500"
                                onclick={() => (showMetaToken = !showMetaToken)}
                            >
                                {showMetaToken ? "Hide" : "Show"}
                            </button>
                        </div>
                        <p class="mt-1 text-xs text-slate-500">
                            Use a system user token with ads_read + ads_management scopes.
                        </p>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>Stored token: {metaCred?.tokenPreview ?? "Not set"}</span>
                        <span>Ad account: {metaAccountFromServer || "Not set"}</span>
                        <span>Updated {formatTimestamp(metaCred?.updated_at)}</span>
                    </div>

                    <div class="flex justify-end">
                        <button
                            type="submit"
                            class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={saving.meta}
                        >
                            {saving.meta ? "Saving…" : "Save Meta key"}
                        </button>
                    </div>
                </form>
            </div>
        </article>
    </section>

    <section class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-6 text-sm text-slate-600">
        <div class="flex items-start gap-4">
            <PlugZap class="h-6 w-6 text-slate-500" />
            <div>
                <p class="text-sm font-semibold text-slate-900">More platforms on the way</p>
                <p>
                    GA4, Klaviyo, and custom webhooks will land in this panel next. We’ll reuse the same workflow so
                    you can drop credentials in seconds and keep every source in sync.
                </p>
            </div>
        </div>
    </section>
</div>
