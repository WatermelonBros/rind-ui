<script lang="ts">
import { RadioGroup, ToggleGroup, Toolbar } from "@rind-ui/svelte"
</script>

<Toolbar.Root aria-label="Formatting">
  <ToggleGroup.Root aria-label="Text style" selectionMode="multiple" defaultValue={["bold"]}>
    <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
    <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
  </ToggleGroup.Root>
  <Toolbar.Separator />
  <RadioGroup.Root aria-label="Alignment" orientation="horizontal" defaultValue="left">
    {#each ["left", "center", "right"] as value (value)}
      <RadioGroup.Item {value}>
        <RadioGroup.ItemControl>
          <RadioGroup.ItemIndicator />
        </RadioGroup.ItemControl>
        <RadioGroup.ItemLabel>{value}</RadioGroup.ItemLabel>
      </RadioGroup.Item>
    {/each}
  </RadioGroup.Root>
  <Toolbar.Separator />
  <Toolbar.Button>Share</Toolbar.Button>
</Toolbar.Root>
