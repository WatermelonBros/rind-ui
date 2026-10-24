<script setup lang="ts">
import { ContextMenu, Menu } from "@rind-ui/vue"
</script>

<template>
  <ContextMenu.Root>
    <ContextMenu.Trigger :tabindex="0" class="context-region">
      README.md
      <small>Right click, long press or Shift+F10</small>
    </ContextMenu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Content aria-label="README.md actions">
          <Menu.Item>Rename</Menu.Item>
          <Menu.Item>Duplicate</Menu.Item>
          <Menu.Separator />
          <Menu.Item>Delete</Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Portal>
  </ContextMenu.Root>
</template>
