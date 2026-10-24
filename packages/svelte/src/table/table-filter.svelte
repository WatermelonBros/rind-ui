<script lang="ts">
import { untrack } from "svelte"
import PopoverRoot from "../popover/popover-root.svelte"
import { columnHost, filterHost } from "./context.svelte"
import type { TableFilterProps } from "./types"

// A Popover scoped to the table, inside a ColumnHeader (design §2).
let {
  active = false,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  children,
}: TableFilterProps = $props()
const column = columnHost.maybe()
if (!column || column.id() === undefined) {
  throw new Error("Table.Filter must be inside a Table.ColumnHeader with an `id`")
}
// Untracked: registering writes the column's count, which this effect must not depend on.
$effect(() => untrack(() => column.addFilter()))
filterHost.set({ column, active: () => active })
</script>

<PopoverRoot scope="table" bind:open {defaultOpen} {onOpenChange}>{@render children?.()}</PopoverRoot>
