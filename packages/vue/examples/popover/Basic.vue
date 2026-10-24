<script setup lang="ts">
import { Popover } from "@rind-ui/vue"
</script>

<template>
  <Popover.Root>
    <Popover.Trigger>
      Share <Popover.Indicator>▾</Popover.Indicator>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Content>
          <Popover.Title>Share this page</Popover.Title>
          <Popover.Description>Anyone with the link can view it.</Popover.Description>
          <input aria-label="Link" readonly value="https://example.com/p/1" />
          <Popover.CloseTrigger>Done</Popover.CloseTrigger>
          <Popover.Arrow />
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
