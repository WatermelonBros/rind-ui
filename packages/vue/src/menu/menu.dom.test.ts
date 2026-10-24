// The Menu contract model (React's: modal, non-modal and loop false, ltr and rtl) against the
// Vue parts, and markup parity (items, checkbox and radio items, groups, a submenu trigger).
import { createListCollection, menuArgs, menuContract, nonModalMenuContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Menu } from "../index"

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
type P = Record<string, unknown>
const example = (p: P) =>
  h("div", { id: "app" }, [
    h(Menu.Root, p, () => [
      h(Menu.Trigger, null, () => "Edit"),
      h(Menu.Portal, null, () =>
        h(Menu.Positioner, null, () =>
          h(Menu.Content, null, () =>
            ITEMS.map((i) => h(Menu.Item, { key: i.key, value: i.key }, () => i.label)),
          ),
        ),
      ),
    ]),
    h("button", { type: "button" }, "After"),
  ])
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
  describe(`vue menu model: ${c.name}`, () => {
    menuArgs.current = { key: "paste", label: "Paste" }
    testMachine(c.modal ? menuContract : nonModalMenuContract, {
      test: it,
      setup: () => mount(() => example({ modal: c.modal, loop: c.loop })),
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

// Everything else, in place (no portal), open.
const full = (p: P) =>
  h(Menu.Root, { defaultOpen: true, id: "edit", ...p }, () => [
    h(Menu.Trigger, null, () => "Edit"),
    h(Menu.Positioner, null, () =>
      h(Menu.Content, null, () => [
        h(Menu.Item, { value: "copy" }, () => [h(Menu.ItemText, null, () => "Copy")]),
        h(Menu.Item, { value: "docs", href: "/docs" }, () => "Docs"),
        h(Menu.Separator),
        h(Menu.CheckboxItem, { value: "wrap", defaultChecked: true }, () => [
          h(Menu.ItemIndicator, null, () => "✓"),
          "Wrap",
        ]),
        h(Menu.Group, null, () => [
          h(Menu.GroupLabel, null, () => "Theme"),
          h(Menu.RadioGroup, { defaultValue: "dark" }, () => [
            h(Menu.RadioItem, { value: "light" }, () => [
              h(Menu.ItemIndicator, { keepMounted: true }),
              "Light",
            ]),
            h(Menu.RadioItem, { value: "dark" }, () => [
              h(Menu.ItemIndicator, { keepMounted: true }),
              "Dark",
            ]),
          ]),
        ]),
        h(Menu.Item, { value: "gone", disabled: true }, () => "Delete"),
        h(Menu.Arrow),
      ]),
    ),
  ])
const reactFull = (p: P) =>
  r(
    R.Menu.Root,
    { defaultOpen: true, id: "edit", ...p },
    r(R.Menu.Trigger, null, "Edit"),
    r(
      R.Menu.Positioner,
      null,
      r(
        R.Menu.Content,
        null,
        r(R.Menu.Item, { value: "copy" }, r(R.Menu.ItemText, null, "Copy")),
        r(R.Menu.Item, { value: "docs", href: "/docs" }, "Docs"),
        r(R.Menu.Separator),
        r(
          R.Menu.CheckboxItem,
          { value: "wrap", defaultChecked: true },
          r(R.Menu.ItemIndicator, null, "✓"),
          "Wrap",
        ),
        r(
          R.Menu.Group,
          null,
          r(R.Menu.GroupLabel, null, "Theme"),
          r(
            R.Menu.RadioGroup,
            { defaultValue: "dark" },
            r(
              R.Menu.RadioItem,
              { value: "light" },
              r(R.Menu.ItemIndicator, { keepMounted: true }),
              "Light",
            ),
            r(
              R.Menu.RadioItem,
              { value: "dark" },
              r(R.Menu.ItemIndicator, { keepMounted: true }),
              "Dark",
            ),
          ),
        ),
        r(R.Menu.Item, { value: "gone", disabled: true }, "Delete"),
        r(R.Menu.Arrow),
      ),
    ),
  )

describe("Vue Menu matches React", () => {
  it("closed and open: items, link, checkbox, radio, group, separator", async () => {
    for (const p of [{ defaultOpen: false }, {}, { modal: false }] as P[]) {
      await serverParity(reactFull(p), () => full(p))
      await clientParity(reactFull(p), () => full(p))
    }
  })
})
