// Model-based tests (task 5.3): the Menu contract over every transition of a root level in
// pointer, touch, keyboard and virtual, ltr and rtl, for modal, non-modal and `loop: false`, with the
// layer, restores-focus, presence, anchored and (modal) modal invariants and axe per state.
// Submenu levels are covered by the submenu DOM and browser tests.
import { createListCollection, menuArgs, menuContract, nonModalMenuContract } from "@rind-ui/core"
import { Menu, type MenuRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const ITEMS = [
  { key: "copy", label: "Copy" },
  { key: "paste", label: "Paste" },
]

function Example(props: Partial<MenuRootProps>) {
  return (
    <div id="app">
      <Menu.Root {...props}>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Content>
              {ITEMS.map((i) => (
                <Menu.Item key={i.key} value={i.key}>
                  {i.label}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <button type="button">After</button>
    </div>
  )
}

const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})

const classes = [
  { name: "modal", modal: true, loop: true },
  { name: "non-modal", modal: false, loop: true },
  { name: "loop: false", modal: true, loop: false },
] as const

for (const c of classes) {
  describe(`menu model: ${c.name}`, () => {
    menuArgs.current = { key: "paste", label: "Paste" }
    testMachine(c.modal ? menuContract : nonModalMenuContract, {
      test: it,
      setup: () => render(<Example modal={c.modal} loop={c.loop} />),
      target: () => screen,
      anchor: [{ name: "Edit" }] as never,
      // Internal props (set by Menu.Root); the oracle only needs values.
      props: {
        open: undefined,
        modal: c.modal,
        loop: c.loop,
        level: "root",
        levelId: "oracle",
        collection,
        strategy: "roving",
        ids: { list: "oracle-content", item: (k: string) => `oracle-${k}` },
        focusableWhenDisabled: true,
        getTrigger: () => null,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      directions: ["ltr", "rtl"],
      a11y,
    })
  })
}

describe("menu model: a wrapper that breaks the trigger name", () => {
  it("the run fails, naming the unnamed button (before the menu it would name opens)", {
    timeout: 60_000,
  }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(menuContract, {
      test: (name, fn) => tests.push({ name, fn }),
      setup: () =>
        render(
          <Menu.Root>
            {/* An icon-only trigger without a name. */}
            <Menu.Trigger>
              <svg aria-hidden="true" width="16" height="16" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="copy">Copy</Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        ),
      target: () => domEnv({ timeout: 200 }),
      anchor: [{ name: /^$/ }] as never,
      props: {
        open: undefined,
        modal: true,
        level: "root",
        levelId: "oracle",
        collection,
        strategy: "roving",
        ids: { list: "oracle-content", item: (k: string) => `oracle-${k}` },
        focusableWhenDisabled: true,
        getTrigger: () => null,
      } as never,
      modalities: ["keyboard"],
    })
    const opening = tests.find(
      (t) => t.name.includes("TRIGGER_PRESS→ open —") || t.name.endsWith("TRIGGER_PRESS→ open"),
    )
    expect(opening).toBeDefined()
    const error = await (opening as (typeof tests)[number]).fn().then(
      () => "",
      (e: Error) => e.message,
    )
    // Caught before it opens: the closed state already has the unnamed button.
    expect(error).toMatch(/\(role button\) has no accessible name/)
  })
})
