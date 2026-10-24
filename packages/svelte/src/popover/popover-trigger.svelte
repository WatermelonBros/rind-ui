<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { api, isOpen, popoverHost, useButton } from "./context.svelte"
import type { PopoverTriggerProps } from "./types"

const { child, children, ...rest }: PopoverTriggerProps = $props()
const ctx = popoverHost.get()
const b = useButton(
  (m) => api(ctx).pressTrigger(m),
  () => ctx.props().disabled === true,
)
const el = elementRef("button")
const merged = $derived.by(() => {
  const own = normalizeProps(
    api(ctx).trigger({
      focused: b.focused,
      modality: b.modality,
      pressed: b.press.pressed,
      tag: el.tag,
    }),
  )
  return stripMarker(
    mergeProps({ ...joinHandlers(own, b.press.props, b.handlers), ...el.props }, rest),
  )
})
const current = $derived({ open: isOpen(ctx) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
