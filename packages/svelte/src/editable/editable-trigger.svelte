<script lang="ts">
import type { EditableEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { editableContext } from "./context"
import type { EditableButtonProps } from "./types"

/** The Edit, Submit or Cancel trigger. */
const {
  kind,
  child,
  children,
  ...rest
}: EditableButtonProps & { kind: "editTrigger" | "submitTrigger" | "cancelTrigger" } = $props()
const ctx = editableContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
const EVENT: Record<typeof kind, EditableEvent> = {
  editTrigger: { type: "EDIT", reason: "edit-trigger" },
  submitTrigger: { type: "SUBMIT", reason: "submit-trigger" },
  cancelTrigger: { type: "CANCEL", reason: "cancel-trigger" },
}
const merged = $derived.by(() => {
  const tag = el.tag
  const native = tag === "button" || tag === "input"
  const api = normalizeProps(ctx.api()[kind]({ tag, focused, modality: modality.current }))
  // A consumer name replaces the default one, labelled-by included.
  if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined)
    api["aria-labelledby"] = undefined
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(api, {
          onclick: () => ctx.send(EVENT[kind]),
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
