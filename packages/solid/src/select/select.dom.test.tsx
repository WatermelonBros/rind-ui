/** @jsxImportSource solid-js */
// The Select contract model (React's classes: single, multiple and non-modal, ltr and rtl)
// against the Solid parts, and markup parity (closed and open in place, a placeholder, a form).
import { createListCollection, selectArgs, selectContract, selectTraits } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Select } from "../index"
import type { SelectRootProps } from "./select"

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
const example = (p: P, portal = true, described = false): JSX.Element => {
  const positioner = () => (
    <Select.Positioner>
      <Select.Content>
        <Select.List>
          <For each={ITEMS}>
            {(i) => (
              <Select.Item value={i.key}>
                <Select.ItemText>{i.label}</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
            )}
          </For>
        </Select.List>
      </Select.Content>
    </Select.Positioner>
  )
  return (
    <div id="app">
      <Select.Root {...(p as Partial<SelectRootProps>)} items={ITEMS} placeholder="Pick one">
        <Select.Label>Fruit</Select.Label>
        <Select.Trigger>
          <Select.ValueText />
          <Select.Indicator />
        </Select.Trigger>
        {/* Not in the model: a modal select makes it inert while open (as React's does). */}
        {described ? <Select.Description>Pick a fruit.</Select.Description> : null}
        {portal ? <Select.Portal>{positioner()}</Select.Portal> : positioner()}
      </Select.Root>
      <button type="button">After</button>
    </div>
  )
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
  describe(`solid select model: ${c.name}`, () => {
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

describe("Solid Select matches React", () => {
  it("placeholder, a value, multiple in a form, open in place, disabled", async () => {
    for (const p of [
      {},
      { defaultValue: "pear" },
      { multiple: true, defaultValue: ["apple", "pear"], name: "fruit" },
      { name: "fruit", required: true, defaultValue: "apple" },
      { disabled: true },
    ] as P[]) {
      const own = { id: "fruit-select", ...p }
      await clientParity(reactExample(own, true, true), () => example(own, true, true))
    }
    for (const p of [{ defaultOpen: true }, { defaultOpen: true, defaultValue: "pear" }] as P[]) {
      const own = { id: "fruit-select", ...p }
      await clientParity(reactExample(own, false), () => example(own, false))
    }
  })
})
