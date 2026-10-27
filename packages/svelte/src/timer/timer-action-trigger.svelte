<script lang="ts">
import { timerActionEvent } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { timerContext } from "./context.svelte"
import type { TimerActionTriggerProps, TimerActionTriggerRenderState } from "./types"

const { action, child, children, ...rest }: TimerActionTriggerProps = $props()
const ctx = timerContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
const triggerState: TimerActionTriggerRenderState = $derived({
  ...ctx.state(),
  action,
  label: action === "toggle" ? ctx.api().toggleLabel() : ctx.messages()[action],
  disabled: !ctx.api().applies(action),
})
const merged = $derived.by(() => {
  const tag = el.tag
  const api = normalizeProps(
    ctx.api().actionTrigger({ action, tag, focused, modality: modality.current }),
  )
  const native = tag === "button" || tag === "input"
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(api, {
          // A disabled trigger stays focusable (aria-disabled): the press does nothing.
          onclick: () => {
            if (ctx.api().applies(action)) ctx.send(timerActionEvent(action))
          },
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
  {@render child({ props: merged, state: triggerState })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{#if children}{@render children(triggerState)}{:else}{triggerState.label}{/if}</button>
{/if}
