<script lang="ts">
import type { Scheduler } from "@rind-ui/core"
import { ContextMenu, Menu, RindProvider } from "../../src/index"

const { root = {}, scheduler }: { root?: Record<string, unknown>; scheduler?: Scheduler } = $props()
const ITEMS = [
  { key: "rename", label: "Rename" },
  { key: "delete", label: "Delete" },
]
</script>

{#snippet tree()}
  <div id="app">
    <ContextMenu.Root {...root}>
      <!-- A focusable region: the context-menu key needs focus inside it. -->
      <ContextMenu.Trigger tabindex={0} style="width: 240px; height: 80px"
        ><button type="button">README.md</button></ContextMenu.Trigger
      >
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Content aria-label="File actions">
            {#each ITEMS as i (i.key)}
              <Menu.Item value={i.key}>{i.label}</Menu.Item>
            {/each}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Portal>
    </ContextMenu.Root>
    <button type="button">After</button>
  </div>
{/snippet}

{#if scheduler}
  <RindProvider environment={{ scheduler }}>{@render tree()}</RindProvider>
{:else}
  {@render tree()}
{/if}
