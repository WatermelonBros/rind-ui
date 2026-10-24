<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { api, popoverHost } from "./context.svelte"
import type { PopoverTitleProps } from "./types"

const { level = 2, child, children, ...rest }: PopoverTitleProps = $props()
const ctx = popoverHost.get()
const id = $derived(partId(ctx.scope(), ctx.root(), "title"))
$effect(() => {
  const own = id
  untrack(() => (ctx.shared.rendered = { ...ctx.shared.rendered, title: own }))
  return () => untrack(() => (ctx.shared.rendered = { ...ctx.shared.rendered, title: undefined }))
})
$effect.pre(() => {
  ctx.shared.titleLevel = level
})
const el = elementRef(() => `h${level}`)
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api(ctx).title({ level, tag: el.tag })), ...el.props }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <svelte:element this={`h${level}`} {...merged as HTMLAttributes<HTMLHeadingElement>}>{@render children?.()}</svelte:element>
{/if}
