<script lang="ts">
import { ToggleGroup } from "../../src/index"
</script>

<ToggleGroup.Root aria-label="A" defaultValue={["center"]}>
  <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
  <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
</ToggleGroup.Root>
<ToggleGroup.Root aria-label="B">
  <ToggleGroup.Item value="x" disabled>X</ToggleGroup.Item>
  <ToggleGroup.Item value="y">Y</ToggleGroup.Item>
</ToggleGroup.Root>
