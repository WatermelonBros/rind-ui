<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tourApi, tourHost } from "./context.svelte"
import Text from "./text.svelte"
import type { TourDescriptionProps } from "./types"

// The step's description: its children, or the shown step's `description`.
const { child, children, ...rest }: TourDescriptionProps = $props()
const ctx = tourHost.get()
const id = untrack(() => partId("tour", ctx.tour.root, "description"))
$effect(() => {
  untrack(() => {
    ctx.shared.rendered = { ...ctx.shared.rendered, description: id }
  })
  return () => {
    ctx.shared.rendered = { ...ctx.shared.rendered, description: undefined }
  }
})
const t = $derived(tourApi(ctx))
const merged = $derived(stripMarker(mergeProps(normalizeProps(t.api.description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <p {...attrs(merged)}>{#if children}{@render children()}{:else}<Text value={t.step?.description} />{/if}</p>
{/if}
