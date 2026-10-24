<script lang="ts">
import { Menu } from "../../src/index"

const { root = {} }: { root?: Record<string, unknown> } = $props()
</script>

<!-- In place (no portal), open by default. No whitespace between parts: React's markup has none. -->
<Menu.Root defaultOpen id="edit" {...root}
  ><Menu.Trigger>Edit</Menu.Trigger><Menu.Positioner
    ><Menu.Content
      ><Menu.Item value="copy"><Menu.ItemText>Copy</Menu.ItemText></Menu.Item><Menu.Item
        value="docs"
        href="/docs">Docs</Menu.Item
      ><Menu.Separator /><Menu.CheckboxItem value="wrap" defaultChecked
        ><Menu.ItemIndicator>✓</Menu.ItemIndicator>Wrap</Menu.CheckboxItem
      ><Menu.Group
        ><Menu.GroupLabel>Theme</Menu.GroupLabel><Menu.RadioGroup defaultValue="dark"
          ><Menu.RadioItem value="light"><Menu.ItemIndicator keepMounted />Light</Menu.RadioItem
          ><Menu.RadioItem value="dark"><Menu.ItemIndicator keepMounted />Dark</Menu.RadioItem
          ></Menu.RadioGroup
        ></Menu.Group
      ><Menu.Item value="gone" disabled>Delete</Menu.Item><Menu.Arrow /></Menu.Content
    ></Menu.Positioner
  ></Menu.Root
>
