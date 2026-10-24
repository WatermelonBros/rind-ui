<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { reasoning } from "./context"
import type { ReasoningTriggerProps } from "./types"

const { child, children, ...rest }: ReasoningTriggerProps = $props()
const ctx = reasoning.get()
const env = useEnvironment()
// Tracking from mount, so the press that focuses it is already known as a pointer one.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().trigger({ focused, modality: modality.current })), {
        onclick: () => ctx.send({ type: "TOGGLE" }),
        onfocus: () => {
          focused = true
        },
        onblur: () => {
          focused = false
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
  <button {...attrs(merged)}
    >{#if children}{@render children(ctx.state())}{:else}{ctx.api().label}{/if}</button
  >
{/if}
