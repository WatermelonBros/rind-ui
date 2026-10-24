<script lang="ts">
import { itemId, visibleText } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { columnHost, tableHost } from "./context.svelte"
import type { TableColumnHeaderProps } from "./types"

const {
  sortable = false,
  id,
  firstDirection = "ascending",
  colSpan,
  child,
  children,
  ...rest
}: TableColumnHeaderProps = $props()
const ctx = tableHost.get()
untrack(() => {
  if (sortable && (id === undefined || id === "")) {
    throw new Error("Table.ColumnHeader: a sortable column needs a non-empty `id`")
  }
})
$effect(() => {
  const own = id
  if (own === undefined) return
  untrack(() => {
    if (DEV && ctx.columns.has(own))
      console.error(`[rind-ui] table: two columns have the id "${own}"`)
    ctx.columns.add(own)
  })
  return () => ctx.columns.delete(own)
})
// A Filter inside: the header is named by its text alone (MUI-X#19239); the text is read after
// mount, without the filter's own button.
const el = elementRef("th")
let filters = $state(0)
let text = $state<string | undefined>(undefined)
$effect(() => {
  void children
  const th = el.current
  if (!th || filters === 0) return
  const copy = th.cloneNode(true) as HTMLElement
  for (const n of Array.from(copy.querySelectorAll('[data-part="filter-trigger"]'))) n.remove()
  text = visibleText(copy)
})
columnHost.set({
  id: () => id,
  firstDirection: () => firstDirection,
  sortable: () => sortable,
  text: () => text ?? id ?? "",
  addFilter: () => {
    filters++
    return () => filters--
  },
})
const domId = $derived(id === undefined ? undefined : itemId("table", ctx.instance(), "column", id))
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(
        ctx.api().columnHeader({ colSpan, column: id, sortable, controls: filters > 0, text }),
      ),
      { colspan: colSpan, ...el.props, ...(domId ? { id: domId } : {}) },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <th {...attrs(merged)}>{@render children?.(ctx.state())}</th>
{/if}
