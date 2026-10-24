<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { fileUploadContext } from "./context"
import type { FileUploadDivProps } from "./types"

const INTERACTIVE =
  'button, a[href], input, select, textarea, label, [role="button"], [contenteditable=""], [contenteditable="true"], [tabindex]'
const { child, children, ...rest }: FileUploadDivProps = $props()
const ctx = fileUploadContext.get()
const el = elementRef("div")
$effect(() => {
  const zone = el.current
  const source = ctx.dropSource()
  if (!(zone instanceof HTMLElement)) return
  return untrack(() =>
    source(zone, {
      enter: () => ctx.send({ type: "DRAG.ENTER" }),
      leave: () => ctx.send({ type: "DRAG.LEAVE" }),
      drop: (files, refused) =>
        ctx.send({
          type: "FILES.ADD",
          files,
          source: "drop",
          ...(refused && refused.length > 0 ? { refused } : {}),
        }),
    }),
  )
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().dropzone()), {
          // A press on the zone's own area opens the chooser; presses on its controls, labels
          // and the input do not (no double open: zag#3387, react-dropzone#182).
          onclick: (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0) return
            const target = e.target as Element
            if (target !== e.currentTarget && target.closest(INTERACTIVE)) return
            ctx.send({ type: "PICKER.OPEN" })
          },
        }),
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
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
