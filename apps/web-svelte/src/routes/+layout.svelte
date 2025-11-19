<script lang="ts">
	import { invalidate } from "$app/navigation";
	import { onMount } from "svelte";
	import favicon from "$lib/assets/favicon.svg";
	import "../app.css";

	let { children, data } = $props();
	let { session, supabase } = $derived(data);

	onMount(() => {
		const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate("supabase:auth");
			}
		});

		return () => data.subscription.unsubscribe();
	});
</script>

{@render children()}
<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
