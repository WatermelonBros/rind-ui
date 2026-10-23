<script lang="ts">
import { ratingFraction } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { ratingContext } from "./context"
import type { RatingItemProps } from "./types"

/** One star: `data-state` full, half or empty; hidden from assistive technology. */
const { index, child, children, ...rest }: RatingItemProps = $props()
const ctx = ratingContext.get()
let released = false
const fraction = (e: { currentTarget: EventTarget | null; clientX: number }) =>
  e.currentTarget instanceof Element
    ? ratingFraction(e.currentTarget.getBoundingClientRect(), e.clientX, ctx.dir())
    : 1
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().item(index)), {
        onpointermove: (e: PointerEvent) => {
          // No hover on touch: a tap sets the value directly.
          if (e.pointerType === "touch") return
          ctx.send({ type: "POINTER.MOVE", index, fraction: fraction(e) })
        },
        // The range input keeps focus: a press on a star must not blur it.
        onpointerdown: (e: PointerEvent) => e.preventDefault(),
        // Activation on release, where the pointer is: a tap, a click, or a half of a star.
        onpointerup: (e: PointerEvent) => {
          if (e.button !== 0) return
          released = true
          ctx.send({
            type: "PRESS",
            index,
            fraction: fraction(e),
            modality: e.pointerType === "touch" ? "touch" : "pointer",
          })
        },
        // A bare click (assistive technology, a script): no pointer before it, a whole star.
        onclick: (e: MouseEvent) => {
          // The click that follows a release is that release's (already pressed).
          const after = released
          released = false
          if (after || e.detail !== 0) return
          ctx.send({ type: "PRESS", index, fraction: 1, modality: "virtual" })
        },
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
