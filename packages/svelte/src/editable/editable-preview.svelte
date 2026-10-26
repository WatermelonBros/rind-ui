<script lang="ts">
import { activates, type EditReason } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { editableContext } from "./context"
import type { EditableButtonProps } from "./types"

/** The value as a button; a press, double-click or focus enters edit by `activationMode`. */
const { child, children, ...rest }: EditableButtonProps = $props()
const ctx = editableContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
$effect(() => {
  const node = el.current
  ctx.previewEl.current = node instanceof HTMLElement ? node : null
})
const enter = (kind: "press" | "dblclick" | "focus" | "key", reason: EditReason) => {
  if (activates(ctx.activationMode(), kind)) ctx.send({ type: "EDIT", reason })
}
const merged = $derived.by(() =>
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(ctx.api().preview({ tag: el.tag, focused, modality: modality.current })),
          {
            onclick: (e: MouseEvent) => {
              // A click without a pointer (an assistive technology's press) is the key path.
              if (e.detail === 0) enter("key", "preview-key")
              else enter("press", "preview-press")
            },
            ondblclick: () => enter("dblclick", "preview-dblclick"),
            onkeydown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" && e.key !== " ") return
              // The native button's own click from the key would enter a second time.
              e.preventDefault()
              if (!e.repeat) enter("key", "preview-key")
            },
            onfocus: () => {
              focused = true
              enter("focus", "preview-focus")
            },
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
  <button {...merged as HTMLButtonAttributes}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().previewText}{/if}</button>
{/if}
