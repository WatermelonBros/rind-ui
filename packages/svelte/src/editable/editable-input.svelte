<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLInputAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { editableContext } from "./context"
import type { EditableInputProps } from "./types"

/** The draft while editing (a textarea through `child`). */
const { child, ...rest }: EditableInputProps = $props()
const ctx = editableContext.get()
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("input")
$effect(() => {
  const node = el.current
  ctx.inputEl.current = node instanceof HTMLElement ? node : null
})
const merged = $derived.by(() =>
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().input({ focused, modality: modality.current })), {
        oninput: (e: Event) =>
          ctx.send({ type: "DRAFT", draft: (e.currentTarget as HTMLInputElement).value }),
        onkeydown: (e: KeyboardEvent) => {
          // An IME composition's Enter and Escape are the composition's.
          if (e.isComposing || e.keyCode === 229) return
          if (e.key === "Enter") {
            if (e.currentTarget instanceof HTMLTextAreaElement && !(e.ctrlKey || e.metaKey)) return
            e.preventDefault()
            ctx.send({ type: "SUBMIT", reason: "enter-key" })
          } else if (e.key === "Escape") {
            e.preventDefault()
            ctx.send({ type: "CANCEL", reason: "escape-key" })
          }
        },
        onfocus: () => (focused = true),
        onblur: () => (focused = false),
      }),
      { ...el.props, ...rest },
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <input {...merged as HTMLInputAttributes} />
{/if}
