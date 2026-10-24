<script lang="ts">
import { ToggleGroup } from "@rind-ui/svelte"
</script>

<ToggleGroup.Root aria-label="Alignment" defaultValue={["left"]}>
  <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
  <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
  <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
</ToggleGroup.Root>
