<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { gridListHost } from "./context.svelte"
import type { GridListPartProps } from "./types"

const { child, children, ...rest }: GridListPartProps = $props()
const host = gridListHost.get()
$effect(() => {
  untrack(() => host.mountLabel(true))
  return () => untrack(() => host.mountLabel(false))
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().label()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
