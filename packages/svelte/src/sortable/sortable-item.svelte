<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { sortableHost, sortableItem } from "./context"
import type { SortableItemProps } from "./types"

const { value, label, disabled = false, child, children, ...rest }: SortableItemProps = $props()
const ctx = sortableHost.get()
const el = elementRef("li")
// The label: the prop, else the item's text (read after each update, as it can change).
$effect(() => {
  void children
  const text = label ?? el.current?.textContent?.replace(/\s+/g, " ").trim()
  const key = value
  const off = disabled
  untrack(() => ctx.register(key, text, off))
})
sortableItem.set(() => value)
const merged = $derived.by(() => {
  const own = normalizeProps(ctx.api().item(value))
  return stripMarker(
    mergeProps(
      ctx.handleDrags()
        ? own
        : joinHandlers(own, {
            onpointerdown: (e: PointerEvent) => {
              if (!disabled) ctx.startDrag(value, e)
            },
          }),
      rest,
      el.props,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <li {...attrs(merged)}>{@render children?.(ctx.state())}</li>
{/if}
