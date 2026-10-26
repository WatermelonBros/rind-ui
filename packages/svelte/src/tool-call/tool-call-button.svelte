<script lang="ts">
import type { ToolCallButtonInput, ToolCallEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { keep, toolCallContext } from "./context"
import type { ToolCallButtonProps } from "./types"

/** The Header, Approve or Deny: modality-aware focus, Enter and Space on a substituted element. */
const {
  kind,
  child,
  children,
  ...rest
}: ToolCallButtonProps & { kind: "header" | "approve" | "deny" } = $props()
const ctx = toolCallContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
const EVENT: Record<typeof kind, ToolCallEvent> = {
  header: { type: "TOGGLE" },
  approve: { type: "APPROVE" },
  deny: { type: "DENY" },
}
const shown = $derived(kind === "header" || ctx.api().decides)
const merged = $derived.by(() => {
  const tag = el.tag
  const native = tag === "button" || tag === "input"
  const b: ToolCallButtonInput = { tag, focused, modality: modality.current }
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api()[kind](b)), {
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
const attachApprove = (node: HTMLElement) =>
  kind === "approve" ? keep(ctx.approveEl)(node) : undefined
</script>

{#if shown}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <button {...merged as HTMLButtonAttributes} {@attach attachApprove}>{@render children?.(ctx.state())}</button>
  {/if}
{/if}
