<script lang="ts">
import { Tooltip } from "@rind-ui/svelte"
</script>

<Tooltip.Root>
  <Tooltip.Trigger>Save</Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Positioner>
      <Tooltip.Content>
        Save the document (Ctrl+S)
        <Tooltip.Arrow />
      </Tooltip.Content>
    </Tooltip.Positioner>
  </Tooltip.Portal>
</Tooltip.Root>
