<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { imageCropper } from "./context"
import type { ImageCropperPartProps } from "./types"

const { child, children, ...rest }: ImageCropperPartProps = $props()
const ctx = imageCropper.get()
const env = useEnvironment()
const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().selection({ focused, modality: modality.current })), {
        onfocus: () => {
          focused = true
        },
        onblur: () => {
          focused = false
        },
        onkeydown: (e: KeyboardEvent) => {
          const arrow = ARROWS[e.key]
          if (arrow) {
            e.preventDefault()
            // Modifiers from the event itself (never a remembered keys-down set).
            const steps = ctx.steps()
            const step = e.ctrlKey || e.metaKey ? steps.ctrl : e.shiftKey ? steps.shift : steps.base
            ctx.send({
              type: "KEY.NUDGE",
              dx: arrow[0] * step,
              dy: arrow[1] * step,
              resize: e.altKey,
            })
            return
          }
          if (e.key === "+" || e.key === "=") {
            e.preventDefault()
            ctx.send({ type: "ZOOM.STEP", direction: 1 })
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault()
            ctx.send({ type: "ZOOM.STEP", direction: -1 })
          }
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
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
