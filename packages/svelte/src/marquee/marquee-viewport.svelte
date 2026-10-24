<script lang="ts">
import { mirror, observeMarquee, retime, reveal } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { marqueeContext } from "./context"
import type { MarqueePartProps } from "./types"

const { child, children, ...rest }: MarqueePartProps = $props()
const ctx = marqueeContext.get()
const env = useEnvironment()
const el = elementRef("div")
const axis = $derived(ctx.state().orientation === "horizontal" ? "x" : "y")
const duration = $derived.by(() => {
  const style = ctx.api().viewport()["style"] as Record<string, string> | undefined
  return Number.parseFloat(style?.["--rind-marquee-duration"] ?? "") * 1000
})
const reverse = $derived(ctx.state().reverse)
const copiesIn = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>(':scope > [data-part="content"]'))
// Measure the viewport and the original copy, once per frame on change.
$effect(() => {
  const viewport = el.current
  const a = axis
  const first = viewport?.querySelector<HTMLElement>(':scope > [data-part="content"]')
  if (!(viewport instanceof HTMLElement) || !first) return
  return untrack(() =>
    observeMarquee(viewport, first, a, env.scheduler, (size) =>
      ctx.send({ type: "MEASURED", ...size }),
    ),
  )
})
// Before paint: a new duration keeps the progress, a new direction keeps the position.
let last = untrack(() => ({ duration, reverse }))
$effect.pre(() => {
  const now = { duration, reverse }
  untrack(() => {
    const prev = last
    last = now
    const viewport = el.current
    if (!(viewport instanceof HTMLElement)) return
    const copies = copiesIn(viewport)
    if (prev.duration !== now.duration) retime(copies, prev.duration, now.duration)
    if (prev.reverse !== now.reverse) mirror(copies, now.duration)
  })
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().viewport()), {
          onpointerenter: (e: PointerEvent) => {
            if (e.pointerType !== "touch") ctx.send({ type: "POINTER.ENTER" })
          },
          onpointerleave: (e: PointerEvent) => {
            if (e.pointerType !== "touch") ctx.send({ type: "POINTER.LEAVE" })
          },
          onfocusin: (e: FocusEvent) => {
            const modality = env.modality.modality()
            ctx.send({ type: "FOCUS.ENTER", modality })
            if (modality !== "keyboard" && modality !== "virtual") return
            const viewport = e.currentTarget
            if (!(viewport instanceof HTMLElement) || !(e.target instanceof Element)) return
            reveal(e.target, viewport, copiesIn(viewport), {
              axis,
              dir: getComputedStyle(viewport).direction === "rtl" ? "rtl" : "ltr",
              reversed: reverse,
              durationMs: duration,
            })
          },
        }),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
