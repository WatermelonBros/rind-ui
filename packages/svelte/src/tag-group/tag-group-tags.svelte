<script lang="ts">
import { tagGroupHost } from "./context"
import Tag from "./tag-group-tag.svelte"
import TagRemove from "./tag-group-tag-remove.svelte"
import TagText from "./tag-group-tag-text.svelte"
import type { TagGroupTagsProps } from "./types"

/** Data mode: every tag of `items`, with its text and (removable) its remove button. */
const { children }: TagGroupTagsProps = $props()
const host = tagGroupHost.get()
const nodes = $derived([...host.collection()].filter((n) => n.type === "item"))
</script>

{#each nodes as node (node.key)}<Tag value={node.key} textValue={node.textValue} disabled={node.disabled}
    >{#if children}{@render children({ label: node.textValue, key: node.key })}{:else}<TagText>{node.textValue}</TagText><TagRemove
      />{/if}</Tag
  >{/each}
