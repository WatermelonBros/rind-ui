<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { api, popoverHost, useButton } from "./context.svelte"
import type { PopoverCloseTriggerProps } from "./types"

const { child, children, ...rest }: PopoverCloseTriggerProps = $props()
const ctx = popoverHost.get()
const b = useButton((m) => api(ctx).pressClose(m))
const el = elementRef("button")
// No content of its own (an icon): named by messages.close.
let empty = $state(false)
$effect(() => {
  void children
  empty = (el.current?.textContent ?? "").trim() === ""
})
const merged = $derived.by(() => {
  const own = normalizeProps(
    api(ctx).closeTrigger({
      focused: b.focused,
      modality: b.modality,
      pressed: b.press.pressed,
      empty,
    }),
  )
  return stripMarker(
    mergeProps({ ...joinHandlers(own, b.press.props, b.handlers), ...el.props }, rest),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.()}</button>
{/if}
