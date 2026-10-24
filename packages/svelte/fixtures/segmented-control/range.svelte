<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, SegmentedControl } from "../../src/index"

const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
]
const {
  defaultValue,
  disabled = [],
  root = {},
  provider = true,
}: {
  defaultValue?: string
  disabled?: readonly string[]
  root?: Record<string, unknown>
  provider?: boolean
} = $props()
</script>

{#snippet form()}
  <form>
    <!-- One line: whitespace between the segments would move the indicator (layout parity). -->
    <SegmentedControl.Root name="range" {defaultValue} {...root}><SegmentedControl.Label>Range</SegmentedControl.Label>{#each RANGES as x (x.value)}<SegmentedControl.Item value={x.value} disabled={disabled.includes(x.value)}>{x.label}</SegmentedControl.Item>{/each}<SegmentedControl.Indicator /></SegmentedControl.Root>
    <button type="button">After</button>
  </form>
{/snippet}

{#if provider}
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }} dir={currentRun()?.direction ?? "ltr"}>
    {@render form()}
  </RindProvider>
{:else}
  {@render form()}
{/if}
