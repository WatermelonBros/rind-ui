<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Menu, Menubar, RindProvider } from "../../src/index"

const {
  root = {},
  disabled = [],
  provider = true,
}: { root?: Record<string, unknown>; disabled?: readonly string[]; provider?: boolean } = $props()
const MENUS: Record<string, string[]> = {
  File: ["New", "Open"],
  Edit: ["Undo", "Redo"],
  View: ["Zoom in", "Zoom out"],
}
</script>

{#snippet bar()}
  <Menubar.Root aria-label="Application" {...root}>
    {#each Object.entries(MENUS) as [label, items] (label)}
      <Menubar.Menu value={label} disabled={disabled.includes(label)}>
        <Menubar.Trigger>{label}</Menubar.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              {#each items as i (i)}<Menu.Item value={i}>{i}</Menu.Item>{/each}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menubar.Menu>
    {/each}
  </Menubar.Root>
{/snippet}

{#if provider}
  <RindProvider
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    dir={currentRun()?.direction ?? "ltr"}
  >
    <button type="button">Before</button>
    {@render bar()}
    <button type="button">After</button>
  </RindProvider>
{:else}
  {@render bar()}
{/if}
