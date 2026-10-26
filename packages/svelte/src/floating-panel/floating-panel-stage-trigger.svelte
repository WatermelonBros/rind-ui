<script lang="ts">
import type { PanelStage } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { floatingPanelContext } from "./context"
import type { FloatingPanelStageTriggerProps } from "./types"

/** `stage` minimized or maximized; from there it restores. */
const { stage, child, children, ...rest }: FloatingPanelStageTriggerProps = $props()
const ctx = floatingPanelContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
const merged = $derived.by(() => {
  const own = normalizeProps(
    ctx.api().stageTrigger(stage, { tag: el.tag, focused, modality: modality.current }),
  )
  const target = own["data-stage-target"] as PanelStage
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, {
          onclick: () => ctx.send({ type: "STAGE", stage: target }),
          onfocus: () => (focused = true),
          onblur: () => (focused = false),
        }),
        ...el.props,
      },
      rest,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
