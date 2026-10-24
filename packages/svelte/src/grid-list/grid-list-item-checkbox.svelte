<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { gridListHost, gridListItem, useControlFocus } from "./context.svelte"
import type { GridListItemCheckboxProps } from "./types"

/**
 * The row's selection checkbox; with `all` (outside the rows, multiple mode) the select-all
 * checkbox: checked, mixed or unchecked from the selection.
 */
const { all = false, child, ...rest }: GridListItemCheckboxProps = $props()
const host = gridListHost.get()
const item = untrack(() => all) ? null : (gridListItem.maybe() ?? null)
if (!untrack(() => all) && !item)
  throw new Error("GridList.ItemCheckbox must be inside GridList.Item")
const focus = useControlFocus()
const el = elementRef("input")
$effect(() => {
  if (!item) return
  const k = item()
  untrack(() => host.mountCheckbox(k, true))
  return () => untrack(() => host.mountCheckbox(k, false))
})
const own = $derived(
  item ? host.parts().itemCheckbox(item(), focus.state()) : host.parts().selectAllCheckbox(),
)
// `indeterminate` is a DOM property, not an attribute.
$effect(() => {
  const node = el.current
  if (!item && node instanceof HTMLInputElement)
    node.indeterminate = own["aria-checked"] === "mixed"
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(own), ...(item ? focus.handlers : {}), ...el.props }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <input {...attrs(merged)} />
{/if}
