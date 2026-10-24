<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { api, popoverHost } from "./context.svelte"
import type { PopoverDescriptionProps } from "./types"

const { child, children, ...rest }: PopoverDescriptionProps = $props()
const ctx = popoverHost.get()
const id = $derived(partId(ctx.scope(), ctx.root(), "description"))
$effect(() => {
  const own = id
  untrack(() => {
    ctx.shared.rendered = { ...ctx.shared.rendered, description: own }
  })
  return () =>
    untrack(() => {
      ctx.shared.rendered = { ...ctx.shared.rendered, description: undefined }
    })
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api(ctx).description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <p {...attrs(merged)}>{@render children?.()}</p>
{/if}
