// The Menu contract model (React's: modal, non-modal and loop false, ltr and rtl) against the
// Svelte parts, and DOM parity (items, checkbox and radio items, groups).
import { createListCollection, menuArgs, menuContract, nonModalMenuContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Edit from "../../fixtures/menu/edit.svelte"
import Full from "../../fixtures/menu/full.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

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
  describe(`svelte menu model: ${c.name}`, () => {
    menuArgs.current = { key: "paste", label: "Paste" }
    testMachine(c.modal ? menuContract : nonModalMenuContract, {
      test: it,
      setup: () => mount(Edit, { root: { modal: c.modal, loop: c.loop } } as never),
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

describe("Svelte Menu matches React", () => {
  it("closed and open: items, link, checkbox, radio, group, separator", async () => {
    for (const p of [{ defaultOpen: false }, {}, { modal: false }] as P[]) {
      await clientParity(reactFull(p), Full, { root: p } as never)
    }
  })
})
