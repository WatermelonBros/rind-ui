// DOM parity with React: closed, a value, chips in a form, free text, inline, open.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import City from "../../fixtures/combobox/city.svelte"
import { CITIES } from "../../fixtures/combobox-model"
import { clientParity } from "../../fixtures/parity"

type P = Record<string, unknown>
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

const svelte = (p: P) => {
  const { inline, ...root } = p
  return {
    root: { id: "city", items: CITIES, ...root },
    inline: inline === true,
    parity: true,
    provider: false,
  }
}

describe("Svelte Combobox matches React", () => {
  it("closed, a value, chips, free text, inline, disabled, required", async () => {
    for (const p of cases) await clientParity(reactExample(p), City, svelte(p) as never)
  })
  it("open, with a value, and filtered", async () => {
    for (const p of [
      { defaultOpen: true },
      { defaultOpen: true, defaultValue: "prague" },
      { defaultOpen: true, multiple: true, defaultValue: ["paris"] },
      { defaultOpen: true, defaultInputValue: "zz", selectionMode: "none" },
    ] as P[]) {
      await clientParity(reactExample(p), City, svelte(p) as never)
    }
  })
})
