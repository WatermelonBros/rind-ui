<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { tourApi, tourHost } from "./context.svelte"
import Text from "./text.svelte"
import type { TourTitleProps } from "./types"

// The step's title: its children, or the shown step's `title`.
const { level = 2, child, children, ...rest }: TourTitleProps = $props()
const ctx = tourHost.get()
const id = untrack(() => partId("tour", ctx.tour.root, "title"))
$effect(() => {
  untrack(() => {
    ctx.shared.rendered = { ...ctx.shared.rendered, title: id }
  })
  return () => {
    ctx.shared.rendered = { ...ctx.shared.rendered, title: undefined }
  }
})
$effect.pre(() => {
  const l = level
  untrack(() => {
    ctx.shared.titleLevel = l
  })
})
// Sound: the heading tag, whichever level (only its name differs).
const el = elementRef(`h${untrack(() => level)}` as "h2")
const t = $derived(tourApi(ctx))
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(t.api.title({ level, tag: el.tag })), ...el.props }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <svelte:element this={`h${level}`} {...merged as HTMLAttributes<HTMLHeadingElement>}
    >{#if children}{@render children()}{:else}<Text value={t.step?.title} />{/if}</svelte:element
  >
{/if}
