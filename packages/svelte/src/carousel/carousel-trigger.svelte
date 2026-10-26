<script lang="ts">
import type { CarouselEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { carouselContext } from "./context"
import type { CarouselButtonProps } from "./types"

/** Prev, Next or the autoplay control. */
const {
  kind,
  child,
  children,
  ...rest
}: CarouselButtonProps & { kind: "prevTrigger" | "nextTrigger" | "autoplayTrigger" } = $props()
const ctx = carouselContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
const EVENT: Record<typeof kind, CarouselEvent> = {
  prevTrigger: { type: "PREV", reason: "trigger" },
  nextTrigger: { type: "NEXT", reason: "trigger" },
  autoplayTrigger: { type: "TOGGLE" },
}
const merged = $derived.by(() => {
  const api = normalizeProps(ctx.api()[kind]({ tag: el.tag, focused, modality: modality.current }))
  const disabled = api["aria-disabled"] === "true"
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(api, {
          // At an end without loop the button stays focusable (aria-disabled) and does nothing.
          onclick: () => {
            if (!disabled) ctx.send(EVENT[kind])
          },
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
