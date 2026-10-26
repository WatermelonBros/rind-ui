<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { signaturePadContext } from "./context"
import type { SignaturePadTriggerProps } from "./types"

/** Clear or Undo: disabled but focusable when there is nothing to do; focus stays. */
const { kind, child, children, ...rest }: SignaturePadTriggerProps & { kind: "clear" | "undo" } =
  $props()
const ctx = signaturePadContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
const merged = $derived.by(() => {
  const tag = el.tag
  const own = kind === "clear" ? ctx.api().clearTrigger : ctx.api().undoTrigger
  const api = normalizeProps(own({ tag, focused, modality: modality.current }))
  // A consumer name replaces the default one, labelled-by included.
  if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined)
    api["aria-labelledby"] = undefined
  const native = tag === "button" || tag === "input"
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(api, {
          onclick: () => ctx.send({ type: kind === "clear" ? "CLEAR" : "UNDO" }),
          // A substituted non-button element: Enter and Space click it, as a button would.
          onkeydown: (e: KeyboardEvent) => {
            if (native || e.repeat) return
            if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
            if (e.key === " ") e.preventDefault()
          },
          onkeyup: (e: KeyboardEvent) => {
            if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
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
