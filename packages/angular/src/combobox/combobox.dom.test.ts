// Markup parity with React: closed, a value, chips in a form, free text, inline, open.
import { Component } from "@angular/core"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { CITIES, ITEMS } from "../../fixtures/combobox-model"
import { both, clientParity } from "../../fixtures/parity"
import { Combobox } from "./combobox"

interface P {
  readonly inline?: boolean
  readonly multiple?: boolean
  readonly selectionMode?: "none" | "single" | "multiple"
  readonly defaultValue?: string | readonly string[]
  readonly defaultInputValue?: string
  readonly defaultOpen?: boolean
  readonly name?: string
  readonly inputName?: string
  readonly disabled?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
}
/** The configuration the next fixture renders. */
let current: P = {}

const ROOT = `rindComboboxRoot
        #cb="rindComboboxRoot"
        id="city"
        [items]="items"
        [multiple]="p.multiple ?? false"
        [selectionMode]="p.selectionMode"
        [defaultValue]="p.defaultValue"
        [defaultInputValue]="p.defaultInputValue"
        [defaultOpen]="p.defaultOpen"
        [name]="p.name"
        [inputName]="p.inputName"
        [disabled]="p.disabled"
        [required]="p.required"
        [invalid]="p.invalid"`

@Component({
  selector: "rind-f",
  imports: [Combobox],
  template: `<div>
    @if (p.inline) {
      <ng-container ${ROOT} inline>
        <label rindComboboxLabel>City</label>
        <div rindComboboxControl><input rindComboboxInput /></div>
        <div rindComboboxList>${ITEMS}</div>
        <div rindComboboxEmpty>None</div>
      </ng-container>
    } @else {
      <ng-container ${ROOT}>
        <label rindComboboxLabel>City</label>
        <div rindComboboxControl>
          <div rindComboboxChips></div>
          <input rindComboboxInput />
          <button rindComboboxClearTrigger>Clear</button>
          <button rindComboboxTrigger>▾</button>
        </div>
        <div rindComboboxPositioner>
          <div rindComboboxPopup>
            <div rindComboboxList>${ITEMS}</div>
            <div rindComboboxEmpty>None</div>
          </div>
        </div>
      </ng-container>
    }
  </div>`,
})
class Example {
  readonly p = current
  readonly items = CITIES
}

const reactExample = (p: P) =>
  r(
    "div",
    null,
    p.inline
      ? r(
          R.Combobox.Root,
          { id: "city", items: CITIES, ...p } as never,
          r(R.Combobox.Label, null, "City"),
          r(R.Combobox.Control, null, r(R.Combobox.Input)),
          r(R.Combobox.List, null, r(R.Combobox.Items)),
          r(R.Combobox.Empty, null, "None"),
        )
      : r(
          R.Combobox.Root,
          { id: "city", items: CITIES, ...p } as never,
          r(R.Combobox.Label, null, "City"),
          r(
            R.Combobox.Control,
            null,
            r(R.Combobox.Chips),
            r(R.Combobox.Input),
            r(R.Combobox.ClearTrigger, null, "Clear"),
            r(R.Combobox.Trigger, null, "▾"),
          ),
          r(
            R.Combobox.Positioner,
            null,
            r(
              R.Combobox.Popup,
              null,
              r(R.Combobox.List, null, r(R.Combobox.Items)),
              r(R.Combobox.Empty, null, "None"),
            ),
          ),
        ),
  )

describe("Angular Combobox matches React", () => {
  for (const p of [
    {},
    { defaultValue: "paris", name: "city" },
    { multiple: true, defaultValue: ["rome", "oslo"], name: "cities" },
    { selectionMode: "none", defaultInputValue: "Pr", inputName: "q" },
    { inline: true },
    { disabled: true, defaultValue: "rome" },
    { required: true, invalid: true, name: "city" },
  ] as P[]) {
    it(`closed ${JSON.stringify(p)}`, async () => {
      current = p
      await both(reactExample(p), Example)
    })
  }
  for (const p of [
    { defaultOpen: true },
    { defaultOpen: true, defaultValue: "prague" },
    { defaultOpen: true, multiple: true, defaultValue: ["paris"] },
    { defaultOpen: true, defaultInputValue: "zz", selectionMode: "none" },
  ] as P[]) {
    it(`open ${JSON.stringify(p)}`, async () => {
      current = p
      await clientParity(reactExample(p), Example)
    })
  }
})
