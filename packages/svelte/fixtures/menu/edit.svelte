<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Menu, RindProvider } from "../../src/index"

const { root = {} }: { root?: Record<string, unknown> } = $props()
const ITEMS = [
  { key: "copy", label: "Copy" },
  { key: "paste", label: "Paste" },
]
</script>

<RindProvider
  dir={currentRun()?.direction ?? "ltr"}
  environment={{ platform: currentRun()?.platform ?? platforms.linux }}
>
  <div id="app">
    <Menu.Root {...root}>
      <Menu.Trigger>Edit</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content>
            {#each ITEMS as i (i.key)}
              <Menu.Item value={i.key}>{i.label}</Menu.Item>
            {/each}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <button type="button">After</button>
  </div>
</RindProvider>
