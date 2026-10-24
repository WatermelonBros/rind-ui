<script lang="ts">
import PopoverContent from "../popover/popover-content.svelte"
import PopoverPortal from "../popover/popover-portal.svelte"
import PopoverPositioner from "../popover/popover-positioner.svelte"
import { filterHost, tableHost } from "./context.svelte"
import type { TableFilterContentProps } from "./types"

const { positionerProps, children, ...rest }: TableFilterContentProps = $props()
const ctx = tableHost.get()
const f = filterHost.get()
const label = $derived(
  ctx.api().filterTrigger(f.column.id() as string, {
    text: f.column.text(),
    active: false,
    named: false,
  })["aria-label"] as string,
)
</script>

<PopoverPortal>
  <PopoverPositioner data-part="filter-positioner" {...positionerProps}>
    <PopoverContent data-part="filter-content" aria-label={label} {...rest}>
      {@render children?.()}
    </PopoverContent>
  </PopoverPositioner>
</PopoverPortal>
