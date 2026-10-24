<script lang="ts">
import { Drawer, type DrawerRootProps } from "../../src/index"

const { root = {}, portal = true }: { root?: Record<string, unknown>; portal?: boolean } = $props()
</script>

<!-- No whitespace between parts: React's markup has none. -->
{#snippet parts()}
  <Drawer.Backdrop style="position: fixed; inset: 0px" /><Drawer.Positioner
    style="position: fixed; inset: 0px"
    ><Drawer.Content style="position: fixed; inset-inline: 0px; bottom: 0px; height: 400px"
      ><Drawer.Handle /><Drawer.Title>Filters</Drawer.Title><Drawer.Description
        >Narrow the list.</Drawer.Description
      ><Drawer.CloseTrigger>Done</Drawer.CloseTrigger></Drawer.Content
    ></Drawer.Positioner>
{/snippet}

<div id="app">
  <Drawer.Indent><Drawer.IndentBackground /></Drawer.Indent><Drawer.Root
    {...(root as DrawerRootProps)}
    ><Drawer.Trigger>Filters</Drawer.Trigger>{#if portal}<Drawer.Portal>{@render parts()}</Drawer.Portal
      >{:else}{@render parts()}{/if}</Drawer.Root
  >
</div>
