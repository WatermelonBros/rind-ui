<script lang="ts">
import type { CollectionKey, SectionNode } from "@rind-ui/core"
import { listboxHost } from "./context"
import Item from "./listbox-item.svelte"
import ItemText from "./listbox-item-text.svelte"
import Section from "./listbox-section.svelte"
import type { ListboxItemsProps } from "./types"

/** Data mode: every section and item of the collection, in render order. */
const { children }: ListboxItemsProps = $props()
const host = listboxHost.get()
const groups = $derived.by(() => {
  const out: { id: string; section: SectionNode | null; keys: CollectionKey[] }[] = []
  for (const node of host.collection()) {
    if (node.type === "section") out.push({ id: `s-${node.key}`, section: node, keys: [] })
    else {
      const last = out.at(-1)
      if (last && (last.section?.key ?? null) === node.parentKey) last.keys.push(node.key)
      else out.push({ id: `run-${out.length}`, section: null, keys: [node.key] })
    }
  }
  return out
})
</script>

{#snippet item(k: CollectionKey)}{@const node = host.collection().get(k)}{#if node}<Item value={k} textValue={node.textValue} disabled={node.disabled}
      >{#if children}{@render children({ label: node.textValue, key: k })}{:else}<ItemText>{node.textValue}</ItemText>{/if}</Item
    >{/if}{/snippet}

{#each groups as g (g.id)}{#if g.section}<Section section={{ key: g.section.key, label: g.section.label }}
      >{#each g.keys as k (k)}{@render item(k)}{/each}</Section
    >{:else}{#each g.keys as k (k)}{@render item(k)}{/each}{/if}{/each}
