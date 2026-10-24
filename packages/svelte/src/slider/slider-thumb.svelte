<script lang="ts">
import { blurEvent, describeKey, focusEvent, sliderKeyEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { sliderContext } from "./context"
import type { SliderThumbProps } from "./types"

/** One thumb and its native range input (the focusable `slider`). */
const {
  index,
  disabled,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  child,
  children,
  ...rest
}: SliderThumbProps = $props()
const ctx = sliderContext.get()
const env = useEnvironment()
$effect(() => {
  const i = index
  const off = disabled
  untrack(() => ctx.setThumbDisabled(i, off))
  return () => untrack(() => ctx.setThumbDisabled(i, false))
})
// Reset (once, on the first input), re-sync after it, and native adoption (AT adjusting).
$effect(() => {
  const i = index
  return untrack(() =>
    ctx.formInput(i).track({
      onReset: () => ctx.send({ type: "RESET" }),
      resetsWithForm: i === 0,
      current: () => ({ value: String(ctx.values()[i] ?? "") }),
      onNativeInput: (input) => {
        ctx.send({ type: "INPUT.CHANGE", thumb: i, value: Number(input.value) })
        return true
      },
    }),
  )
})
const own = $derived({
  disabled,
  ariaLabel: ariaLabel ?? undefined,
  ariaLabelledBy: ariaLabelledBy ?? undefined,
  name,
})
const inputProps = $derived(
  joinHandlers(normalizeProps(ctx.api().input(index, own)), {
    onkeydown: (e: KeyboardEvent) => {
      const event = sliderKeyEvent(describeKey(e, env), index, {
        orientation: ctx.orientation(),
        dir: ctx.dir(),
        platform: env.platform,
        dragging: ctx.state().dragging,
      })
      if (!event || e.defaultPrevented) return
      // Neither the native input nor the page reacts (RX#1054, KB#293).
      e.preventDefault()
      // Escape ends the drag only: a surrounding layer stays open.
      if (event.type === "DRAG.CANCEL") e.stopPropagation()
      ctx.send(event)
    },
    onfocus: (e: FocusEvent) => {
      if (e.currentTarget instanceof Element)
        ctx.send({ ...focusEvent(e.currentTarget, env.modality), thumb: index })
    },
    onblur: () => ctx.send({ ...blurEvent(env.modality), thumb: index }),
  }),
)
const captureThumb = (node: Element) => {
  const i = index
  ctx.thumbs[i] = node
  return () => {
    if (ctx.thumbs[i] === node) ctx.thumbs[i] = null
  }
}
const captureInput = (node: HTMLInputElement) => {
  const i = index
  ctx.inputs[i] = node
  return () => {
    if (ctx.inputs[i] === node) ctx.inputs[i] = null
  }
}
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().thumb(index, own)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach captureThumb}>{@render children?.(ctx.state())}<input {...attrs(inputProps)} {@attach captureInput} /></div>
{/if}
