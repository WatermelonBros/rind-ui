<script setup lang="ts">
import { Tooltip } from "@rind-ui/vue"
</script>

<template>
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
</template>
