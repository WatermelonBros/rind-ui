/** @jsxImportSource solid-js */
import { Drawer } from "@rind-ui/solid"
import { For } from "solid-js"

const FILTERS = ["In stock", "On sale", "Free shipping", "New arrivals", "Top rated"]

export function Basic() {
  return (
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
              <For each={FILTERS}>
                {(f) => (
                  <li>
                    <label class="row">
                      <input type="checkbox" /> {f}
                    </label>
                  </li>
                )}
              </For>
            </ul>
            <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
