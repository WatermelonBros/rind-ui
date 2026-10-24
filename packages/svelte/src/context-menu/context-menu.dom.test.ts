// The Context Menu contract model (React's: modal and non-modal, every opening path, long
// presses on a virtual clock) against the Svelte parts, and DOM parity.
import {
  contextMenuContract,
  createListCollection,
  menuArgs,
  nonModalContextMenuContract,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Files from "../../fixtures/context-menu/files.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

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
type P = Record<string, unknown>
const reactTree = (p: P) =>
  r(
    "div",
    { id: "app" },
    r(
      R.ContextMenu.Root,
      p,
      r(
        R.ContextMenu.Trigger,
        { tabIndex: 0, style: { width: 240, height: 80 } },
        r("button", { type: "button" }, "README.md"),
      ),
      r(
        R.Menu.Portal,
        null,
        r(
          R.Menu.Positioner,
          null,
          r(
            R.Menu.Content,
            { "aria-label": "File actions" },
            ITEMS.map((i) => r(R.Menu.Item, { key: i.key, value: i.key }, i.label)),
          ),
        ),
      ),
    ),
    r("button", { type: "button" }, "After"),
  )
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
  describe(`svelte context menu model: ${c.name}`, () => {
    menuArgs.current = { key: "delete", label: "Delete" }
    testMachine(c.modal ? contextMenuContract : nonModalContextMenuContract, {
      test: it,
      setup: () =>
        mount(Files, {
          root: { modal: c.modal, longPress: c.longPress },
          scheduler: clock.scheduler,
        } as never),
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

describe("Svelte Context Menu matches React", () => {
  it("closed, disabled, no long press", async () => {
    for (const p of [{}, { disabled: true }, { longPress: false }] as P[]) {
      await clientParity(reactTree(p), Files, { root: p } as never)
    }
  })
})
