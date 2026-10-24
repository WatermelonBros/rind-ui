// The Select contract model (React's classes: single, multiple and non-modal, ltr and rtl)
// against the Vue parts, and markup parity (closed and open in place, a placeholder, a form).
import { createListCollection, selectArgs, selectContract, selectTraits } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Select } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const ITEMS = [
  { key: "apple", label: "Apple" },
  { key: "pear", label: "Pear" },
]
type P = Record<string, unknown>
const example = (p: P, portal = true, described = false) => {
  const positioner = () =>
    h(Select.Positioner, null, () =>
      h(Select.Content, null, () =>
        h(Select.List, null, () =>
          ITEMS.map((i) =>
            h(Select.Item, { key: i.key, value: i.key }, () => [
              h(Select.ItemText, null, () => i.label),
              h(Select.ItemIndicator, null, () => "✓"),
            ]),
          ),
        ),
      ),
    )
  return h("div", { id: "app" }, [
    h(Select.Root, { ...p, items: ITEMS, placeholder: "Pick one" }, () => [
      h(Select.Label, null, () => "Fruit"),
      h(Select.Trigger, null, () => [h(Select.ValueText), h(Select.Indicator)]),
      // Not in the model: a modal select makes it inert while open (as React's does).
      described ? h(Select.Description, null, () => "Pick a fruit.") : null,
      portal ? h(Select.Portal, null, positioner) : positioner(),
    ]),
    h("button", { type: "button" }, "After"),
  ])
}
const reactExample = (p: P, portal = true, described = false) => {
  const positioner = r(
    R.Select.Positioner,
    null,
    r(
      R.Select.Content,
      null,
      r(
        R.Select.List,
        null,
        ITEMS.map((i) =>
          r(
            R.Select.Item,
            { key: i.key, value: i.key },
            r(R.Select.ItemText, null, i.label),
            r(R.Select.ItemIndicator, null, "✓"),
          ),
        ),
      ),
    ),
  )
  return r(
    "div",
    { id: "app" },
    r(
      R.Select.Root,
      { ...p, items: ITEMS, placeholder: "Pick one" } as never,
      r(R.Select.Label, null, "Fruit"),
      r(R.Select.Trigger, null, r(R.Select.ValueText), r(R.Select.Indicator)),
      described ? r(R.Select.Description, null, "Pick a fruit.") : null,
      portal ? r(R.Select.Portal, null, positioner) : positioner,
    ),
    r("button", { type: "button" }, "After"),
  )
}
const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})
const classes = [
  { name: "single", multiple: false, modal: true },
  { name: "multiple", multiple: true, modal: true },
  { name: "non-modal", multiple: false, modal: false },
] as const
for (const c of classes) {
  describe(`vue select model: ${c.name}`, () => {
    selectArgs.current = { key: "pear", label: "Pear" }
    testMachine(
      { ...selectContract, traits: selectTraits({ modal: c.modal }) },
      {
        test: it,
        setup: () => mount(() => example({ multiple: c.multiple, modal: c.modal })),
        target: () => screen,
        anchor: [{ name: "Fruit" }] as never,
        // Internal props (set by Select.Root); the oracle only needs values.
        props: {
          open: undefined,
          modal: c.modal,
          collection,
          strategy: "roving",
          selectionMode: c.multiple ? "multiple" : "single",
          ids: { list: "oracle-list", item: (k: string) => `oracle-${k}` },
          root: "oracle",
          disabled: false,
          readOnly: false,
          selectionBehavior: "toggle",
          disallowEmptySelection: false,
          getTrigger: () => null,
        } as never,
        modalities: ["pointer", "keyboard", "touch", "virtual"],
        directions: ["ltr", "rtl"],
        a11y,
      },
    )
  })
}

describe("Vue Select matches React", () => {
  it("placeholder, a value, multiple in a form, open in place, disabled", async () => {
    for (const p of [
      {},
      { defaultValue: "pear" },
      { multiple: true, defaultValue: ["apple", "pear"], name: "fruit" },
      { name: "fruit", required: true, defaultValue: "apple" },
      { disabled: true },
    ] as P[]) {
      const own = { id: "fruit-select", ...p }
      await serverParity(reactExample(own, true, true), () => example(own, true, true))
      await clientParity(reactExample(own, true, true), () => example(own, true, true))
    }
    for (const p of [{ defaultOpen: true }, { defaultOpen: true, defaultValue: "pear" }] as P[]) {
      const own = { id: "fruit-select", ...p }
      await clientParity(reactExample(own, false), () => example(own, false))
    }
  })
})
