<script lang="ts">
import Part from "./timeline-item-part.svelte"
import type { TimelinePartProps } from "./types"

const props: TimelinePartProps = $props()
</script>

<Part {...props} part="connector" />
