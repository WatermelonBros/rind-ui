<script lang="ts">
import type { Snippet } from "svelte"

// A step's text: a string, or a snippet.
const { value }: { value: string | Snippet | undefined } = $props()
</script>

{#if typeof value === "function"}{@render value()}{:else if value !== undefined}{value}{/if}
