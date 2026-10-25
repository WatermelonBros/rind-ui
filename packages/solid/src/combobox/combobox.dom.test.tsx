/** @jsxImportSource solid-js */
// Markup parity with React: closed, a value, chips in a form, free text, inline, open.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { CITIES } from "../../fixtures/combobox-model"
import { clientParity } from "../../fixtures/parity"
import { Combobox } from "../index"
import type { ComboboxRootProps } from "./combobox"

type P = Record<string, unknown>
const root = (p: P) => ({ id: "city", items: CITIES, ...p })
const example = (p: P) => (): JSX.Element => (
  <div>
    {p["inline"] ? (
      <Combobox.Root {...(root(p) as ComboboxRootProps)}>
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Control>
          <Combobox.Input />
        </Combobox.Control>
        <Combobox.List>
          <Combobox.Items />
        </Combobox.List>
        <Combobox.Empty>None</Combobox.Empty>
      </Combobox.Root>
    ) : (
      <Combobox.Root {...(root(p) as ComboboxRootProps)}>
        <Combobox.Label>City</Combobox.Label>
        <Combobox.Control>
          <Combobox.Chips />
          <Combobox.Input />
          <Combobox.ClearTrigger>Clear</Combobox.ClearTrigger>
          <Combobox.Trigger>▾</Combobox.Trigger>
        </Combobox.Control>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              <Combobox.Items />
            </Combobox.List>
            <Combobox.Empty>None</Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Root>
    )}
  </div>
)
const reactExample = (p: P) =>
  r(
    "div",
    null,
    p["inline"]
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
const cases: P[] = [
  {},
  { defaultValue: "paris", name: "city" },
  { multiple: true, defaultValue: ["rome", "oslo"], name: "cities" },
  { selectionMode: "none", defaultInputValue: "Pr", inputName: "q" },
  { inline: true },
  { disabled: true, defaultValue: "rome" },
  { required: true, invalid: true, name: "city" },
]

describe("Solid Combobox matches React", () => {
  it("closed, a value, chips, free text, inline, disabled, required", async () => {
    for (const p of cases) await clientParity(reactExample(p), example(p))
  })
  it("open, with a value, and filtered", async () => {
    for (const p of [
      { defaultOpen: true },
      { defaultOpen: true, defaultValue: "prague" },
      { defaultOpen: true, multiple: true, defaultValue: ["paris"] },
      { defaultOpen: true, defaultInputValue: "zz", selectionMode: "none" },
    ] as P[]) {
      await clientParity(reactExample(p), example(p))
    }
  })
})
