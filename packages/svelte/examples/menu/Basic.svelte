<script lang="ts">
import { Menu } from "@rind-ui/svelte"
</script>

<Menu.Root>
  <Menu.Trigger>Actions <span aria-hidden="true">▾</span></Menu.Trigger>
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Content>
        <Menu.Item>New file</Menu.Item>
        <Menu.Item>Duplicate</Menu.Item>
        <Menu.Item href="/docs/menu/#link-items">Open the docs</Menu.Item>
        <Menu.Separator />
        <Menu.Item disabled>Delete</Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Portal>
</Menu.Root>
