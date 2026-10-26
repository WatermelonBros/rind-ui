<script lang="ts">
import { preventTouchScribble, startStroke, startsStroke } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { signaturePadContext } from "./context"
import type { SignaturePadControlProps } from "./types"

const { child, children, ...rest }: SignaturePadControlProps = $props()
const ctx = signaturePadContext.get()
let stop: (() => void) | null = null
const onpointerdown = (e: PointerEvent) => {
  const s = ctx.state()
  if (!startsStroke(e) || s.disabled || s.readOnly || s.state === "drawing") return
  // A press on a trigger inside the Control is the trigger's, not a stroke.
  if ((e.target as Element).closest?.("button, [role='button']")) return
  e.preventDefault()
  stop?.()
  stop = startStroke(e.currentTarget as HTMLElement, e, (m) => {
    if (m.type === "down") {
      ctx.send({ type: "POINTER.DOWN", pointerId: m.pointerId, point: m.point, box: m.box })
    } else if (m.type === "move") {
      ctx.send({ type: "POINTER.MOVE", pointerId: m.pointerId, points: m.points })
    } else {
      stop = null
      ctx.send({ type: m.type === "up" ? "POINTER.UP" : "POINTER.CANCEL", pointerId: m.pointerId })
    }
  })
}
const attach = (node: HTMLElement) => {
  ctx.control.current = node
  const undo = preventTouchScribble(node)
  return () => {
    undo()
    stop?.()
    if (ctx.control.current === node) ctx.control.current = null
  }
}
const merged = $derived(
  stripMarker(
    mergeProps(joinHandlers(normalizeProps(ctx.api().control()), { onpointerdown }), rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach attach}>{@render children?.(ctx.state())}</div>
{/if}
