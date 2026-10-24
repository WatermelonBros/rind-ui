// The Select contract model (React's classes: single, multiple and non-modal, ltr and rtl)
// against the Svelte parts, and DOM parity (closed and open in place, a placeholder, a form).
import { createListCollection, selectArgs, selectContract, selectTraits } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Fruit from "../../fixtures/select/fruit.svelte"

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
  describe(`svelte select model: ${c.name}`, () => {
    selectArgs.current = { key: "pear", label: "Pear" }
    testMachine(
      { ...selectContract, traits: selectTraits({ modal: c.modal }) },
      {
        test: it,
        setup: () => mount(Fruit, { root: { multiple: c.multiple, modal: c.modal } } as never),
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

describe("Svelte Select matches React", () => {
  it("placeholder, a value, multiple in a form, open in place, disabled", async () => {
    for (const p of [
      {},
      { defaultValue: "pear" },
      { multiple: true, defaultValue: ["apple", "pear"], name: "fruit" },
      { name: "fruit", required: true, defaultValue: "apple" },
      { disabled: true },
    ] as P[]) {
      const own = { id: "fruit-select", ...p }
      await clientParity(reactExample(own, true, true), Fruit, {
        root: own,
        described: true,
      } as never)
    }
    for (const p of [{ defaultOpen: true }, { defaultOpen: true, defaultValue: "pear" }] as P[]) {
      const own = { id: "fruit-select", ...p }
      await clientParity(reactExample(own, false), Fruit, { root: own, portal: false } as never)
    }
  })
})
