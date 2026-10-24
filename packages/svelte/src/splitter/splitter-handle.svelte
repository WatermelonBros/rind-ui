<script lang="ts">
import {
  blurEvent,
  describeKey,
  focusEvent,
  splitterKeyEvent,
  warnUnnamedHandle,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { splitterContext } from "./context"
import type { SplitterHandleProps } from "./types"

/** The focusable `separator` between panel `index` and the next one. */
const { index, disabled, child, children, ...rest }: SplitterHandleProps = $props()
const ctx = splitterContext.get()
const env = useEnvironment()
$effect(() => {
  const i = index
  const off = disabled
  untrack(() => ctx.setHandleDisabled(i, off))
  return () => untrack(() => ctx.setHandleDisabled(i, false))
})
$effect(() => {
  const i = index
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  untrack(() => warnUnnamedHandle(i, named))
})
// The modality tracker must see the pointerdown that comes before the handle's focus.
$effect(() => env.modality.subscribe(() => {}))
const capture = (node: Element) => {
  const i = index
  ctx.handles[i] = node
  return () => {
    if (ctx.handles[i] === node) ctx.handles[i] = null
  }
}
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().handle(index, { disabled })), {
        onpointerdown: (e: PointerEvent) => {
          const el = e.currentTarget
          if (!(el instanceof Element) || el.hasAttribute("data-disabled") || !ctx.press(e)) return
          // No text selection and no native focus: the machine focuses without a ring.
          e.preventDefault()
          ctx.send({
            type: "POINTER.DOWN",
            handle: index,
            modality: e.pointerType === "touch" ? "touch" : "pointer",
          })
        },
        onkeydown: (e: KeyboardEvent) => {
          const event = splitterKeyEvent(describeKey(e, env), index, {
            orientation: ctx.orientation(),
            dir: ctx.dir(),
            dragging: ctx.state().dragging,
          })
          if (!event || e.defaultPrevented) return
          e.preventDefault()
          // Escape ends the drag only: a surrounding layer stays open.
          if (event.type === "DRAG.CANCEL") e.stopPropagation()
          ctx.send(event)
        },
        onfocus: (e: FocusEvent) => {
          if (e.currentTarget instanceof Element)
            ctx.send({ ...focusEvent(e.currentTarget, env.modality), handle: index })
        },
        onblur: () => ctx.send({ ...blurEvent(env.modality), handle: index }),
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach capture}>{@render children?.(ctx.state())}</div>
{/if}
