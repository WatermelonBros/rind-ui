// The Select contract model (React's classes: single, multiple and non-modal, ltr and rtl)
// against the Angular parts, and markup parity (closed and open in place, a placeholder, a form).
import { Component } from "@angular/core"
import { createListCollection, selectArgs, selectContract, selectTraits } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both, clientParity } from "../../fixtures/parity"
import { Select } from "./select"

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
interface P {
  readonly id?: string
  readonly multiple?: boolean
  readonly modal?: boolean
  readonly defaultValue?: string | readonly string[]
  readonly defaultOpen?: boolean
  readonly name?: string
  readonly required?: boolean
  readonly disabled?: boolean
}
/** The configuration the next fixture renders. */
let current: { p: P; portal: boolean; described: boolean } = {
  p: {},
  portal: true,
  described: false,
}

const POSITIONER = `<div rindSelectPositioner>
          <div rindSelectContent>
            <div rindSelectList>
              @for (i of items; track i.key) {
                <div rindSelectItem [value]="i.key">
                  <span rindSelectItemText>{{ i.label }}</span>
                  <span rindSelectItemIndicator>✓</span>
                </div>
              }
            </div>
          </div>
        </div>`

@Component({
  selector: "rind-f",
  imports: [Select],
  template: `<div id="app">
    <ng-container
      rindSelectRoot
      [items]="items"
      placeholder="Pick one"
      [id]="p.id"
      [multiple]="p.multiple ?? false"
      [modal]="p.modal ?? true"
      [defaultValue]="p.defaultValue"
      [defaultOpen]="p.defaultOpen"
      [name]="p.name"
      [required]="p.required"
      [disabled]="p.disabled"
    >
      <span rindSelectLabel>Fruit</span>
      <button rindSelectTrigger><span rindSelectValueText></span><span rindSelectIndicator></span></button>
      @if (described) {
        <div rindSelectDescription>Pick a fruit.</div>
      }
      @if (portal) {
        <ng-template rindSelectPortal>${POSITIONER}</ng-template>
      } @else {
        ${POSITIONER}
      }
    </ng-container>
    <button type="button">After</button>
  </div>`,
})
class Example {
  readonly items = ITEMS
  readonly p = current.p
  readonly portal = current.portal
  readonly described = current.described
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
  describe(`angular select model: ${c.name}`, () => {
    selectArgs.current = { key: "pear", label: "Pear" }
    testMachine(
      { ...selectContract, traits: selectTraits({ modal: c.modal }) },
      {
        test: it,
        setup: () => {
          current = { p: { multiple: c.multiple, modal: c.modal }, portal: true, described: false }
          return mount(Example)
        },
        target: () => screen,
        anchor: [{ name: "Fruit" }] as never,
        // Internal props (set by the Root); the oracle only needs values.
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

describe("Angular Select matches React", () => {
  for (const p of [
    {},
    { defaultValue: "pear" },
    { multiple: true, defaultValue: ["apple", "pear"], name: "fruit" },
    { name: "fruit", required: true, defaultValue: "apple" },
    { disabled: true },
  ] as P[]) {
    it(`closed ${JSON.stringify(p)}`, async () => {
      const own = { id: "fruit-select", ...p }
      current = { p: own, portal: true, described: true }
      await both(reactExample(own, true, true), Example)
    })
  }
  for (const p of [{ defaultOpen: true }, { defaultOpen: true, defaultValue: "pear" }] as P[]) {
    it(`open in place ${JSON.stringify(p)}`, async () => {
      const own = { id: "fruit-select", ...p }
      current = { p: own, portal: false, described: false }
      await clientParity(reactExample(own, false), Example)
    })
  }
})
