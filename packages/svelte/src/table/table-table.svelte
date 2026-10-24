<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLTableAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { tableHost, warnOnce } from "./context.svelte"
import type { TableTableProps } from "./types"

const { loading = false, child, children, ...rest }: TableTableProps = $props()
const ctx = tableHost.get()
const el = elementRef("table")
$effect.pre(() => {
  ctx.tableLabel.current = rest["aria-label"] ?? undefined
})
// After commit: the Caption, or a label, names the table (spec "Name").
$effect(() => {
  void ctx.captioned()
  void rest["aria-label"]
  void rest["aria-labelledby"]
  // After the update a Caption or a Title causes when it registers.
  queueMicrotask(() => {
    const t = el.current
    if (!(t instanceof HTMLTableElement) || !t.isConnected) return
    if (t.caption || t.hasAttribute("aria-label") || t.hasAttribute("aria-labelledby")) return
    warnOnce(
      ctx.instance(),
      "a table needs a name: render Table.Caption, Table.Title or aria-label",
    )
  })
})
// No Caption and no label of its own: the Frame's Title names it.
const titled = $derived(
  !ctx.captioned() &&
    rest["aria-label"] === undefined &&
    rest["aria-labelledby"] === undefined &&
    ctx.frame?.shared.title !== undefined,
)
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(ctx.api().table({ loading })),
      { ...el.props, ...(titled ? { "aria-labelledby": ctx.frame?.shared.title } : {}) },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <table {...merged as HTMLTableAttributes}>{@render children?.(ctx.state())}</table>
{/if}
