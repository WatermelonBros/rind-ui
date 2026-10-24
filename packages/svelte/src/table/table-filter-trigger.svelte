<script lang="ts">
import { normalizeProps } from "../normalize-props"
import PopoverTrigger from "../popover/popover-trigger.svelte"
import VisuallyHidden from "../visually-hidden.svelte"
import { filterHost, tableHost } from "./context.svelte"
import type { TableFilterTriggerProps } from "./types"

const { children, ...rest }: TableFilterTriggerProps = $props()
const ctx = tableHost.get()
const f = filterHost.get()
const id = $derived(f.column.id() as string)
const own = $derived(
  normalizeProps(
    ctx.api().filterTrigger(id, {
      text: f.column.text(),
      active: f.active(),
      named: rest["aria-label"] != null || rest["aria-labelledby"] != null,
    }),
  ),
)
const filterState = $derived(ctx.api().filterState(id, f.active()))
</script>

<PopoverTrigger {...own} {...rest}>
  {@render children?.()}
  {#if filterState}<VisuallyHidden id={filterState.id} aria-hidden="true">{filterState.text}</VisuallyHidden>{/if}
</PopoverTrigger>
