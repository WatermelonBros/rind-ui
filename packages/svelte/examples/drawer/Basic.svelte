<script lang="ts">
import { Drawer } from "@rind-ui/svelte"

const FILTERS = ["In stock", "On sale", "Free shipping", "New arrivals", "Top rated"]
</script>

<Drawer.Root>
  <Drawer.Trigger>Filters</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Backdrop />
    <Drawer.Positioner>
      <Drawer.Content>
        <Drawer.Handle />
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the product list.</Drawer.Description>
        <ul class="stack">
          {#each FILTERS as f (f)}
            <li><label class="row"><input type="checkbox" /> {f}</label></li>
          {/each}
        </ul>
        <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
      </Drawer.Content>
    </Drawer.Positioner>
  </Drawer.Portal>
</Drawer.Root>
