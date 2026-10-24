<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { tourApi, tourHost } from "./context.svelte"
import type { TourTriggerProps } from "./types"

const { child, children, ...rest }: TourTriggerProps = $props()
const ctx = tourHost.get()
const env = useEnvironment()
// The modality tracker needs a subscriber while the trigger is mounted.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") tourApi(ctx).api.pressTrigger(e.modality)
  },
})
const el = elementRef("button")
const api = $derived(tourApi(ctx).api)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api.trigger({
              focused,
              modality: modality.current,
              pressed: press.pressed,
              tag: el.tag,
            }),
          ),
          press.props,
          {
            onfocus: () => {
              focused = true
            },
            onblur: () => {
              focused = false
            },
          },
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current = $derived({ open: api.open })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
