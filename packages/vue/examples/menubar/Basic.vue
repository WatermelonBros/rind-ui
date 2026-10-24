<script setup lang="ts">
import { Menu, Menubar } from "@rind-ui/vue"
import { ref } from "vue"

const wrap = ref(true)
const zoom = ref<string | null>("100")
</script>

<template>
  <Menubar.Root aria-label="Application">
    <Menubar.Menu value="File">
      <Menubar.Trigger>File</Menubar.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item aria-keyshortcuts="Control+N">New<span aria-hidden="true" data-hint="">Ctrl+N</span></Menu.Item>
            <Menu.Item aria-keyshortcuts="Control+O">Open…<span aria-hidden="true" data-hint="">Ctrl+O</span></Menu.Item>
            <Menu.Submenu>
              <Menu.SubmenuTrigger>Open recent</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item>notes.md</Menu.Item>
                    <Menu.Item>plan.md</Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Submenu>
            <Menu.Separator />
            <Menu.Item disabled aria-keyshortcuts="Control+S">Save<span aria-hidden="true" data-hint="">Ctrl+S</span></Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menubar.Menu>
    <Menubar.Menu value="Edit">
      <Menubar.Trigger>Edit</Menubar.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item aria-keyshortcuts="Control+Z">Undo<span aria-hidden="true" data-hint="">Ctrl+Z</span></Menu.Item>
            <Menu.Item disabled aria-keyshortcuts="Control+Shift+Z">Redo<span aria-hidden="true" data-hint="">Ctrl+Shift+Z</span></Menu.Item>
            <Menu.Separator />
            <Menu.Item aria-keyshortcuts="Control+F">Find…<span aria-hidden="true" data-hint="">Ctrl+F</span></Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menubar.Menu>
    <Menubar.Menu value="View">
      <Menubar.Trigger>View</Menubar.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.CheckboxItem v-model:checked="wrap">
              <Menu.ItemIndicator>✓</Menu.ItemIndicator>
              Word wrap
            </Menu.CheckboxItem>
            <Menu.Separator />
            <Menu.Group>
              <Menu.GroupLabel>Zoom</Menu.GroupLabel>
              <Menu.RadioGroup v-model="zoom">
                <Menu.RadioItem v-for="z in ['75', '100', '150']" :key="z" :value="z">
                  <Menu.ItemIndicator>•</Menu.ItemIndicator>
                  {{ z }}%
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Group>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menubar.Menu>
  </Menubar.Root>
</template>
