<script lang="ts">
import { Timeline } from "../../src/index"

const {
  root = {},
  pendingLast = false,
}: { root?: Record<string, unknown>; pendingLast?: boolean } = $props()
const EVENTS = ["Ordered", "Shipped", "Delivered"]
</script>

<Timeline.Root aria-label="Order" {...root}>
  {#each EVENTS as title, index (title)}<Timeline.Item {index} {...pendingLast && index === 2 ? { status: "pending" as const } : {}}
      ><Timeline.Indicator /><Timeline.Connector /><Timeline.Content
        ><Timeline.Title>{title}</Timeline.Title><Timeline.Time datetime="2026-10-20T09:00:00.000Z">Oct 20</Timeline.Time></Timeline.Content
      ><Timeline.Opposite>Note</Timeline.Opposite><Timeline.Description>{title} details</Timeline.Description></Timeline.Item
    >{/each}
</Timeline.Root>
