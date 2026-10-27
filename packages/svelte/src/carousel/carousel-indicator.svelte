<script lang="ts">
import { carouselIndicatorKeyEvent, describeKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { carouselContext } from "./context"
import type { CarouselIndicatorProps } from "./types"

/** One page (`index`). */
const { index, child, children, ...rest }: CarouselIndicatorProps = $props()
const ctx = carouselContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api().indicator(index, { tag: el.tag, focused, modality: modality.current }),
          ),
          {
            onclick: () => ctx.send({ type: "GO", page: index, reason: "indicator" }),
            onkeydown: (e: KeyboardEvent) => {
              const s = ctx.state()
              const event = carouselIndicatorKeyEvent(describeKey(e, env), {
                page: s.page,
                pages: s.pages,
                orientation: ctx.orientation(),
                dir: ctx.dir(),
              })
              if (event?.type !== "GO") return
              e.preventDefault()
              ctx.send(event)
              // The roving tab stop follows the selection.
              const group = (e.currentTarget as Element).closest('[data-part="indicator-group"]')
              group
                ?.querySelector<HTMLElement>(`[data-part="indicator"][data-index="${event.page}"]`)
                ?.focus()
            },
            onfocus: () => (focused = true),
            onblur: () => (focused = false),
          },
        ),
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
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
