<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { marqueeContext } from "./context"
import type { MarqueePauseTriggerProps } from "./types"

const { child, children, ...rest }: MarqueePauseTriggerProps = $props()
const ctx = marqueeContext.get()
const env = useEnvironment()
// Tracking from mount, so the press that focuses it is already known as a pointer one.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.api().pauseTrigger({ focused, modality: modality.current })),
        {
          onclick: () => ctx.send({ type: "TRIGGER.PRESS", modality: env.modality.modality() }),
          onfocus: () => (focused = true),
          onblur: () => (focused = false),
        },
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
