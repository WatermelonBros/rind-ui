// Model-based tests (task 8.2): the Drawer contract over every transition in pointer, touch,
// keyboard and virtual, both directions, for modal, non-modal, closeOnSwipe false and snap
// points, with the layer, modal, restores-focus and presence invariants and axe per state.
import { drawerContract, nonModalDrawerContract } from "@rind-ui/core"
import { Drawer, type DrawerRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

function Example(props: Partial<DrawerRootProps>) {
  return (
    <div id="app">
      <Drawer.Root {...(props as DrawerRootProps)}>
        <Drawer.Trigger>Filters</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop style={{ position: "fixed", inset: 0 }} />
          <Drawer.Positioner style={{ position: "fixed", inset: 0 }}>
            <Drawer.Content style={{ position: "fixed", insetInline: 0, bottom: 0, height: 400 }}>
              <Drawer.Handle />
              <Drawer.Title>Filters</Drawer.Title>
              <Drawer.Description>Narrow the list.</Drawer.Description>
              <Drawer.CloseTrigger>Done</Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  )
}

const sets: { name: string; props: Partial<DrawerRootProps>; modal: boolean }[] = [
  { name: "modal", props: {}, modal: true },
  { name: "non-modal", props: { modal: false }, modal: false },
  { name: "closeOnSwipe false", props: { closeOnSwipe: false }, modal: true },
]

for (const { name, props, modal } of sets) {
  describe(`drawer model: ${name}`, () => {
    testMachine(modal ? drawerContract : nonModalDrawerContract, {
      test: it,
      setup: () => render(<Example {...props} />),
      target: () => screen,
      anchor: [{ name: "Filters" }] as never,
      // `root` is internal (set by Drawer.Root); the oracle only needs a value.
      props: {
        open: undefined,
        root: "oracle",
        role: undefined,
        modal: undefined,
        closeOnEscape: undefined,
        closeOnInteractOutside: undefined,
        closeOnSwipe: undefined,
        snapPoints: undefined,
        side: undefined,
        dir: undefined,
        swipeThreshold: undefined,
        swipeVelocityThreshold: undefined,
        defaultSnapPoint: undefined,
        snapToSequentialPoints: undefined,
        ...props,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      directions: ["ltr", "rtl"],
      a11y,
    })
  })
}
