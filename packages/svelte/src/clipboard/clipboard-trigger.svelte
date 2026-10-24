<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { clipboardContext, useFocus } from "./context.svelte"
import type { ClipboardTriggerProps } from "./types"

const { child, children, ...rest }: ClipboardTriggerProps = $props()
const ctx = clipboardContext.get()
const el = elementRef("button")
$effect(() => {
  const node = el.current
  ctx.copyAnchor.current = node instanceof HTMLElement ? node : null
})
const focus = useFocus()
const merged = $derived.by(() => {
  const tag = el.tag
  const api = normalizeProps(
    ctx.api().trigger({ focused: focus.focused, modality: focus.modality, tag }),
  )
  // A consumer name replaces the default one, labelled-by included (spec "Trigger Name").
  if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined)
    api["aria-labelledby"] = undefined
  const native = tag === "button" || tag === "input"
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(api, {
          // The write starts in the click's task (WebKit's user-activation rule); an assistive
          // technology press is a bare click too.
          onclick: () => ctx.send({ type: "COPY" }),
          // A substituted non-button element: Enter and Space click it, as a button would.
          onkeydown: (e: KeyboardEvent) => {
            if (native || e.repeat) return
            if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
            if (e.key === " ") e.preventDefault()
          },
          onkeyup: (e: KeyboardEvent) => {
            if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
          },
          onfocus: () => (focus.focused = true),
          onblur: () => (focus.focused = false),
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
