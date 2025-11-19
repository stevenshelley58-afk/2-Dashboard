<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";

    let { shops } = $props();

    // Derived state for current shop
    let currentShopId = $derived($page.params.shopId);

    function handleChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        goto(`/dashboard/${select.value}`);
    }
</script>

<select
    value={currentShopId}
    onchange={handleChange}
    class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
>
    {#if !currentShopId}
        <option value="" disabled selected>Select a shop</option>
    {/if}
    {#each shops as shop}
        <option value={shop.id}>{shop.name}</option>
    {/each}
</select>
