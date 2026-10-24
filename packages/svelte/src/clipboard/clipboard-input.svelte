<script lang="ts">
import { clipboardInputCopy } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { clipboardContext, useFocus } from "./context.svelte"
import type { ClipboardInputProps } from "./types"

const { id, child, ...rest }: ClipboardInputProps = $props()
const ctx = clipboardContext.get()
const own = $derived(id ?? ctx.ids().input)
useRegisterPart(ctx.registry, "input", () => own)
const focus = useFocus()
// The pointer press that focuses the Input selects the whole value after its mouseup (which
// would collapse a selection made on focus, in Safari and Chrome); later presses keep the
// native selection.
let selectOnUp = false
const asInput = (t: EventTarget | null) => (t instanceof HTMLInputElement ? t : null)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(ctx.api().input({ focused: focus.focused, modality: focus.modality })),
          {
            onpointerdown: (e: PointerEvent) => {
              if (document.activeElement !== e.currentTarget) selectOnUp = true
            },
            onmouseup: (e: MouseEvent) => {
              if (!selectOnUp) return
              selectOnUp = false
              e.preventDefault()
              asInput(e.currentTarget)?.select()
            },
            onfocus: (e: FocusEvent) => {
              focus.focused = true
              const m = focus.env.modality.modality()
              if (m !== "pointer" && m !== "touch") asInput(e.currentTarget)?.select()
            },
            onblur: () => {
              focus.focused = false
              selectOnUp = false
            },
            oncopy: (e: Event) => {
              const input = asInput(e.currentTarget)
              if (!input) return
              ctx.send(
                clipboardInputCopy({
                  value: input.value,
                  selectionStart: input.selectionStart,
                  selectionEnd: input.selectionEnd,
                }),
              )
            },
          },
        ),
        id: own,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <!-- The value attribute follows the value (as React's controlled input): a form reset keeps it. -->
  <input {...attrs(merged)} defaultValue={merged["value"] as string} />
{/if}
