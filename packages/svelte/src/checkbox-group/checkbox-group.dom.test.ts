// The Checkbox Group contract model (React's configurations) against the Svelte parts, and DOM
// parity with @rind-ui/react.
import { checkboxGroupArgs, checkboxGroupContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Group from "../../fixtures/checkbox-group/group.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const ALL = ["a", "b", "c"] as const
const LABELS: Record<string, string> = { a: "Olives", b: "Basil", c: "Chili" }
const base = {
  value: undefined,
  defaultValue: undefined,
  onValueChange: undefined,
  allValues: undefined,
  disabled: undefined,
  readOnly: undefined,
}
interface Cfg {
  readonly parent?: boolean
  readonly disabledItem?: string
  readonly root?: Record<string, unknown>
}
for (const { name, cfg, applying } of [
  { name: "no Parent", cfg: {} },
  { name: "Parent", cfg: { parent: true } },
  { name: "disabled item", cfg: { disabledItem: "c" } },
  { name: "disabled group", cfg: { parent: true, root: { disabled: true } } },
  { name: "read-only group", cfg: { parent: true, root: { readonly: true } } },
  { name: "required group", cfg: { parent: true, root: { required: true } } },
  { name: "controlled, applying", cfg: { parent: true }, applying: true },
] as { name: string; cfg: Cfg; applying?: boolean }[]) {
  describe(`svelte checkbox group model: ${name}`, () => {
    testMachine(checkboxGroupContract, {
      test: it,
      setup: () => {
        checkboxGroupArgs.current = { item: "a", label: "Olives" }
        return mount(Group, { ...cfg, applying: applying === true } as never)
      },
      target: () => screen,
      anchor: [{ name: "Toppings" }] as never,
      props: {
        ...base,
        ...(cfg.parent ? { allValues: ALL } : {}),
        disabled: cfg.root?.["disabled"],
        readOnly: cfg.root?.["readonly"],
      } as never,
      a11y,
    })
  })
}

const reactGroup = (cfg: Cfg) =>
  r(
    "form",
    null,
    r(
      R.CheckboxGroup.Root,
      { name: "toppings", ...(cfg.parent ? { allValues: ALL } : {}), ...cfg.root } as never,
      r(R.CheckboxGroup.Label, null, "Toppings"),
      cfg.parent
        ? r(
            R.CheckboxGroup.Parent,
            null,
            r(R.CheckboxGroup.ItemControl),
            r(R.CheckboxGroup.ItemLabel, null, "All toppings"),
          )
        : null,
      ...ALL.map((v) =>
        r(
          R.CheckboxGroup.Item,
          { key: v, value: v, disabled: cfg.disabledItem === v },
          r(R.CheckboxGroup.ItemControl),
          r(R.CheckboxGroup.ItemLabel, null, LABELS[v]),
        ),
      ),
    ),
  )
describe("Svelte Checkbox Group matches React", () => {
  it("values, Parent, disabled, required, error", async () => {
    for (const cfg of [
      {},
      { parent: true, root: { defaultValue: ["a"] } },
      { parent: true, root: { defaultValue: ["a", "b", "c"] } },
      { disabledItem: "b", root: { required: true, invalid: true } },
    ] as Cfg[]) {
      await clientParity(reactGroup(cfg), Group, { ...cfg, provider: false } as never)
    }
  })
})
