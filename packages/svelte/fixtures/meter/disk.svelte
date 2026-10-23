<script lang="ts">
import { Meter, type MeterRootProps } from "../../src/index"

const props: MeterRootProps = $props()
</script>

<Meter.Root {...props}>
  <Meter.Label>Disk</Meter.Label>
  <Meter.ValueText />
  <Meter.Track><Meter.Indicator /></Meter.Track>
</Meter.Root>
