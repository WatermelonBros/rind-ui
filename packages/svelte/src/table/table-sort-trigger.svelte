<script lang="ts">
import { visibleText } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import VisuallyHidden from "../visually-hidden.svelte"
import { tableHost, useFocus, useSortColumn } from "./context.svelte"
import type { TableSortTriggerProps } from "./types"

const { child, children, ...rest }: TableSortTriggerProps = $props()
const ctx = tableHost.get()
const column = useSortColumn("SortTrigger")
const f = useFocus()
const sortState = $derived(ctx.api().sortState(column.id()))
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps(
          ctx.api().sortTrigger(column.id(), { focused: f.focused, modality: f.modality }),
        ),
        f.handlers,
        {
          // A native button: pointer, Enter, Space and an assistive technology's bare click.
          onclick: (e: MouseEvent) =>
            ctx.send({
              type: "SORT",
              column: column.id(),
              name: visibleText(e.currentTarget as HTMLElement),
              firstDirection: column.firstDirection(),
              modality: f.env.modality.modality(),
            }),
        },
      ),
      rest,
    ),
  ),
)
</script>

{#snippet content()}
  {@render children?.(ctx.state())}
  <!-- Hidden from the name (aria-hidden); still read as the description. -->
  {#if sortState}<VisuallyHidden id={sortState.id} aria-hidden="true">{sortState.text}</VisuallyHidden>{/if}
{/snippet}

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render content()}</button>
{/if}
