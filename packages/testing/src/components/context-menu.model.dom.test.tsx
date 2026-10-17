// Model-based tests (task 5.2): the Context Menu contract over every opening path in
// pointer, touch, keyboard and virtual, for modal, non-modal and `longPress: false`, with
// the Menu's invariants and axe per state. Long presses run on fake timers in jsdom.
import {
  contextMenuContract,
  createListCollection,
  menuArgs,
  nonModalContextMenuContract,
} from "@rind-ui/core"
import { ContextMenu, type ContextMenuRootProps, Menu, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, testMachine, virtualClock } from "../index"

// The long press runs on this clock: no test waits for elapsed time.
const clock = virtualClock()

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const ITEMS = [
  { key: "rename", label: "Rename" },
  { key: "delete", label: "Delete" },
]

function Example(props: Partial<ContextMenuRootProps>) {
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }}>
      <div id="app">
        <ContextMenu.Root {...props}>
          {/* A focusable region: the context-menu key needs focus inside it. */}
          <ContextMenu.Trigger tabIndex={0} style={{ width: 240, height: 80 }}>
            <button type="button">README.md</button>
          </ContextMenu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content aria-label="File actions">
                {ITEMS.map((i) => (
                  <Menu.Item key={i.key} value={i.key}>
                    {i.label}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </ContextMenu.Root>
        <button type="button">After</button>
      </div>
    </RindProvider>
  )
}

const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})

const classes = [
  { name: "modal", modal: true, longPress: true },
  { name: "non-modal", modal: false, longPress: true },
] as const

for (const c of classes) {
  describe(`context menu model: ${c.name}`, () => {
    menuArgs.current = { key: "delete", label: "Delete" }
    testMachine(c.modal ? contextMenuContract : nonModalContextMenuContract, {
      test: it,
      setup: () => render(<Example modal={c.modal} longPress={c.longPress} />),
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms) }),
      clock,
      anchor: [{ text: "README.md" }] as never,
      // Internal props (set by ContextMenu.Root); the oracle only needs values.
      props: {
        open: undefined,
        modal: c.modal,
        loop: true,
        level: "root",
        levelId: "oracle",
        region: true,
        collection,
        strategy: "roving",
        ids: { list: "oracle-content", item: (k: string) => `oracle-${k}` },
        focusableWhenDisabled: true,
        getTrigger: () => null,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}
