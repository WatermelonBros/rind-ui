<script lang="ts">
import { blurEvent, describeKey, focusEvent, ratingKeyEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { ratingContext } from "./context"
import type { RatingControlProps } from "./types"

/**
 * The stars' row and the pointer surface; renders the range input and the form carrier after
 * its children. Leaving it ends the hover preview.
 */
const { child, children, ...rest }: RatingControlProps = $props()
const ctx = ratingContext.get()
const env = useEnvironment()
// The modality tracker must see the pointerdown that comes before the input's focus.
$effect(() => env.modality.subscribe(() => {}))
const capture =
  <K extends "input" | "carrier" | "control">(key: K) =>
  (node: Element) => {
    ;(ctx[key] as { current: Element | null }).current = node
    return () => {
      if ((ctx[key] as { current: Element | null }).current === node)
        (ctx[key] as { current: Element | null }).current = null
    }
  }
const inputProps = $derived(
  joinHandlers(normalizeProps(ctx.api().input()), {
    onkeydown: (e: KeyboardEvent) => {
      const event = ratingKeyEvent(describeKey(e, env), { dir: ctx.dir(), platform: env.platform })
      if (!event || e.defaultPrevented) return
      // Neither the native input nor the page reacts (RX#1054, KB#293).
      e.preventDefault()
      ctx.send(event)
    },
    onfocus: (e: FocusEvent) => {
      if (e.currentTarget instanceof Element) ctx.send(focusEvent(e.currentTarget, env.modality))
    },
    onblur: () => ctx.send(blurEvent(env.modality)),
  }),
)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().control()), {
        onpointerleave: () => ctx.send({ type: "POINTER.LEAVE" }),
      }),
      rest,
    ),
  ),
)
</script>

{#snippet inputs()}<input {...attrs(inputProps)} {@attach capture("input")} /><input
    {...attrs(normalizeProps(ctx.api().hiddenInput()))}
    {@attach capture("carrier")}
  />{/snippet}

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)} {@attach capture("control")}>{@render children?.(ctx.state())}{@render inputs()}</div>
{/if}
