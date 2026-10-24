<script lang="ts">
import { SegmentedControl } from "@rind-ui/svelte"
</script>

<!-- Svelte keeps the whitespace between inline elements: the segments touch, as in JSX. -->
<SegmentedControl.Root aria-label="Range" defaultValue="week"
  ><SegmentedControl.Item value="day">Day</SegmentedControl.Item
  ><SegmentedControl.Item value="week">Week</SegmentedControl.Item
  ><SegmentedControl.Item value="month">Month</SegmentedControl.Item
  ><SegmentedControl.Indicator
/></SegmentedControl.Root>
