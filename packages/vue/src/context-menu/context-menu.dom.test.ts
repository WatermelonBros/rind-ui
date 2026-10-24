// The Context Menu contract model (React's: modal and non-modal, every opening path, long
// presses on a virtual clock) against the Vue parts, and markup parity.
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
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { ContextMenu, Menu, RindProvider } from "../index"

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
const tree = (p: P) =>
  h("div", { id: "app" }, [
    h(ContextMenu.Root, p, () => [
      // A focusable region: the context-menu key needs focus inside it.
      h(ContextMenu.Trigger, { tabindex: 0, style: { width: "240px", height: "80px" } }, () =>
        h("button", { type: "button" }, "README.md"),
      ),
      h(Menu.Portal, null, () =>
        h(Menu.Positioner, null, () =>
          h(Menu.Content, { "aria-label": "File actions" }, () =>
            ITEMS.map((i) => h(Menu.Item, { key: i.key, value: i.key }, () => i.label)),
          ),
        ),
      ),
    ]),
    h("button", { type: "button" }, "After"),
  ])
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
  describe(`vue context menu model: ${c.name}`, () => {
    menuArgs.current = { key: "delete", label: "Delete" }
    testMachine(c.modal ? contextMenuContract : nonModalContextMenuContract, {
      test: it,
      setup: () =>
        mount(() =>
          h(RindProvider, { environment: { scheduler: clock.scheduler } }, () =>
            tree({ modal: c.modal, longPress: c.longPress }),
          ),
        ),
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

describe("Vue Context Menu matches React", () => {
  it("closed, disabled, no long press", async () => {
    for (const p of [{}, { disabled: true }, { longPress: false }] as P[]) {
      await serverParity(reactTree(p), () => tree(p))
      await clientParity(reactTree(p), () => tree(p))
    }
  })
})
