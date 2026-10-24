<script setup lang="ts">
import { Drawer } from "@rind-ui/vue"

const FILTERS = ["In stock", "On sale", "Free shipping", "New arrivals", "Top rated"]
</script>

<template>
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
            <li v-for="f in FILTERS" :key="f">
              <label class="row"><input type="checkbox" /> {{ f }}</label>
            </li>
          </ul>
          <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Portal>
  </Drawer.Root>
</template>
