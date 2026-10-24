<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { calendarHost } from "./context"
import type { CalendarTriggerProps } from "./types"

const { child, children, ...rest }: CalendarTriggerProps = $props()
const ctx = calendarHost.get()
const env = useEnvironment()
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const own = $derived(ctx.api().trigger(1, { focused, modality: modality.current }))
const press = usePress({
  env,
  disabled: () => own["aria-disabled"] === "true",
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "PAGE", direction: 1, modality: e.modality })
  },
})
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(own), press.props, {
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
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}>{#if children}{@render children()}{:else}{own["children"] as string}{/if}</button>
{/if}
