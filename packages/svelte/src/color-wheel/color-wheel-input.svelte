<script lang="ts">
import { angleSliderKeyEvent, describeKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLInputAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { colorWheelContext } from "./context"
import type { ColorWheelInputProps } from "./types"

/** A visually hidden native range input of the hue: the one focusable slider. */
const rest: ColorWheelInputProps = $props()
const ctx = colorWheelContext.get()
const env = useEnvironment()
$effect(() =>
  untrack(() =>
    ctx.rangeInput.track({
      // The hex input owns the form reset.
      onReset: () => {},
      resetsWithForm: false,
      current: () => ({ value: String(ctx.state().hue) }),
      // The native range input's own change (assistive technology, a click on it).
      onNativeInput: (el) => {
        ctx.send({ type: "INPUT.CHANGE", value: Number(el.value) })
        return true
      },
    }),
  ),
)
const capture = (node: HTMLInputElement) => {
  ctx.input.current = node
  return () => {
    if (ctx.input.current === node) ctx.input.current = null
  }
}
// The value is written as a property by hiddenFormInput; `defaultValue` is the attribute (as React).
const merged = $derived.by(() => {
  const { value: _value, ...own } = normalizeProps(ctx.api().input())
  return stripMarker(
    mergeProps(
      joinHandlers(own, {
        onkeydown: (e: KeyboardEvent) => {
          const event = angleSliderKeyEvent(describeKey(e, env), {
            dragging: ctx.state().dragging,
          })
          if (!event || e.defaultPrevented) return
          e.preventDefault()
          // Escape ends the drag only: a surrounding layer stays open.
          if (event.type === "DRAG.CANCEL") e.stopPropagation()
          ctx.send(event)
        },
        onfocus: () => ctx.setFocused(true),
        onblur: () => ctx.setFocused(false),
      }),
      rest,
    ),
  )
})
</script>

<input {...merged as HTMLInputAttributes} {@attach capture} />
