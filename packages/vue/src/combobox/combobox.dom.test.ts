// Markup parity with React: closed, a value, chips in a form, free text, inline, open.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { CITIES } from "../../fixtures/combobox-model"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Combobox } from "../index"

type P = Record<string, unknown>
const example = (p: P) => () =>
  h("div", [
    p["inline"]
      ? h(Combobox.Root, { id: "city", items: CITIES, ...p }, () => [
          h(Combobox.Label, null, () => "City"),
          h(Combobox.Control, null, () => h(Combobox.Input)),
          h(Combobox.List, null, () => h(Combobox.Items)),
          h(Combobox.Empty, null, () => "None"),
        ])
      : h(Combobox.Root, { id: "city", items: CITIES, ...p }, () => [
          h(Combobox.Label, null, () => "City"),
          h(Combobox.Control, null, () => [
            h(Combobox.Chips),
            h(Combobox.Input),
            h(Combobox.ClearTrigger, null, () => "Clear"),
            h(Combobox.Trigger, null, () => "▾"),
          ]),
          h(Combobox.Positioner, null, () =>
            h(Combobox.Popup, null, () => [
              h(Combobox.List, null, () => h(Combobox.Items)),
              h(Combobox.Empty, null, () => "None"),
            ]),
          ),
        ]),
  ])
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
// Vue props in Vue's names (the value is `modelValue` when controlled; these are uncontrolled).
const cases: P[] = [
  {},
  { defaultValue: "paris", name: "city" },
  { multiple: true, defaultValue: ["rome", "oslo"], name: "cities" },
  { selectionMode: "none", defaultInputValue: "Pr", inputName: "q" },
  { inline: true },
  { disabled: true, defaultValue: "rome" },
  { required: true, invalid: true, name: "city" },
]

describe("Vue Combobox matches React", () => {
  it("closed, a value, chips, free text, inline, disabled, required", async () => {
    for (const p of cases) {
      await serverParity(reactExample(p), example(p))
      await clientParity(reactExample(p), example(p))
    }
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
