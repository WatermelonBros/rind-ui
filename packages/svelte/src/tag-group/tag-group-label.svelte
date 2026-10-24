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
  untrack(() => host.mount("label", true))
  return () => untrack(() => host.mount("label", false))
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().label()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
