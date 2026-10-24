<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagGroupHost } from "./context"
import type { TagGroupSpanProps } from "./types"

const { child, children, ...rest }: TagGroupSpanProps = $props()
const host = tagGroupHost.get()
$effect(() => {
  untrack(() => host.mount("description", true))
  return () => untrack(() => host.mount("description", false))
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
