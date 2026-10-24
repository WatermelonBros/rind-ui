<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { rowHost, tableHost, useFocus } from "./context.svelte"
import type { TableRowTriggerProps } from "./types"

const { child, children, ...rest }: TableRowTriggerProps = $props()
const ctx = tableHost.get()
const row = rowHost.maybe()
if (!row || row.id() === undefined) {
  throw new Error("Table.RowTrigger must be inside a Table.Row with an `id`")
}
const f = useFocus()
const merged = $derived.by(() => {
  const id = row.id() as string
  const named = rest["aria-label"] != null || rest["aria-labelledby"] != null
  const own = normalizeProps(
    ctx.api().rowTrigger(id, {
      text: row.text() ?? id,
      named,
      focused: f.focused,
      modality: f.modality,
    }),
  )
  return stripMarker(
    mergeProps(
      joinHandlers(own, f.handlers, {
        onclick: () => ctx.send({ type: "ROW.TOGGLE", row: id }),
      }),
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
