<script lang="ts">
import { itemId, visibleText } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { rowHost, tableHost } from "./context.svelte"
import type { TableRowProps } from "./types"

const { id, child, children, ...rest }: TableRowProps = $props()
const ctx = tableHost.get()
const el = elementRef("tr")
let text = $state<string | undefined>(undefined)
// The RowHeader's text, read after each update.
$effect(() => {
  void children
  if (id === undefined) return
  const header = el.current?.querySelector<HTMLElement>(':scope > [data-part="row-header"]')
  text = header ? visibleText(header) : undefined
})
rowHost.set({ id: () => id, text: () => text ?? id })
const domId = $derived(id === undefined ? undefined : itemId("table", ctx.instance(), "row", id))
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(ctx.api().row(id)),
      { ...el.props, ...(domId ? { id: domId } : {}) },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <tr {...attrs(merged)}>{@render children?.(ctx.state())}</tr>
{/if}
