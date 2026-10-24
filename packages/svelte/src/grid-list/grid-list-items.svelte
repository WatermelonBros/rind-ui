<script lang="ts">
import { gridListHost } from "./context.svelte"
import Item from "./grid-list-item.svelte"
import ItemText from "./grid-list-item-text.svelte"
import type { GridListItemsProps } from "./types"

/** Data mode: every row of `items`, with its text. */
const { children }: GridListItemsProps = $props()
const host = gridListHost.get()
const nodes = $derived([...host.collection()].filter((n) => n.type === "item"))
</script>

{#each nodes as node (node.key)}<Item value={node.key} textValue={node.textValue} disabled={node.disabled}
    >{#if children}{@render children({ label: node.textValue, key: node.key })}{:else}<ItemText>{node.textValue}</ItemText>{/if}</Item
  >{/each}
