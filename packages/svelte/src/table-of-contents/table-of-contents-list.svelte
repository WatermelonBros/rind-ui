<script lang="ts">
import { cssZoom } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tocContext } from "./context"
import type { TableOfContentsListProps } from "./types"

const { child, children, ...rest }: TableOfContentsListProps = $props()
const ctx = tocContext.get()
const el = elementRef("ol")
// The current link: the Indicator's box, and kept in view when the List scrolls (Starlight
// #3617), by the List's own scrollTop only (scrollIntoView would move the page too).
$effect(() => {
  void ctx.state().value
  const list = el.current
  untrack(() => {
    const link = list?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!(list instanceof HTMLElement) || !link) {
      ctx.setMarker(null)
      return
    }
    const box = list.getBoundingClientRect()
    const own = link.getBoundingClientRect()
    // rects are viewport pixels; the marker is placed in the list's own (zoomed) ones
    const z = cssZoom(list)
    const top = (own.top - box.top) / z + list.scrollTop
    const height = own.height / z
    ctx.setMarker({ top, height })
    if (list.scrollHeight > list.clientHeight) {
      if (top < list.scrollTop) list.scrollTop = top
      else if (top + height > list.scrollTop + list.clientHeight)
        list.scrollTop = top + height - list.clientHeight
    }
  })
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().list()), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <ol {...attrs(merged)}>{@render children?.(ctx.state())}</ol>
{/if}
