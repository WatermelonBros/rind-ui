<script lang="ts">
import { type ColorPickerFormat, PICKER_FORMATS } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { colorPicker } from "./context"
import { useFocusAttrs } from "./focus-attrs.svelte"
import type { ColorPickerSelectProps } from "./types"

// A native select of the formats.
const { child, ...rest }: ColorPickerSelectProps = $props()
const ctx = colorPicker.get()
const focus = useFocusAttrs()
let el: HTMLSelectElement | null = null
// The value is set as a property.
$effect(() => {
  const f = ctx.format()
  untrack(() => {
    if (el) el.value = f
  })
})
const ref = (node: HTMLSelectElement) => {
  el = node
  node.value = ctx.format()
  return () => {
    el = null
  }
}
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().formatSelect()), {
          onchange: (e: Event) =>
            ctx.send({
              type: "FORMAT.SET",
              format: (e.currentTarget as HTMLSelectElement).value as ColorPickerFormat,
            }),
        }),
        ...focus(),
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <select {...attrs(merged)} {@attach ref}
    >{#each PICKER_FORMATS as f (f)}<option value={f} selected={f === ctx.format() || undefined}
        >{ctx.messages().formatOptions(f)}</option
      >{/each}</select
  >
{/if}
