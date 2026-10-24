// The Checkbox Group contract model (React's configurations) against the Angular parts, and
// markup parity with @rind-ui/react.
import { Component, signal } from "@angular/core"
import { checkboxGroupArgs, checkboxGroupContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { CheckboxGroup } from "./checkbox-group"

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
interface Root {
  readonly defaultValue?: readonly string[]
  readonly disabled?: boolean
  readonly readonly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
}
interface Cfg {
  readonly parent?: boolean
  readonly disabledItem?: string
  readonly root?: Root
  readonly applying?: boolean
}
/** The configuration the next fixture renders. */
let current: Cfg = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, CheckboxGroup],
  template: `<ng-container rindProvider [environment]="env">
    <form>
      <div
        rindCheckboxGroupRoot
        name="toppings"
        [allValues]="cfg.parent ? all : undefined"
        [defaultValue]="root.defaultValue"
        [disabled]="root.disabled ?? false"
        [readonly]="root.readonly ?? false"
        [required]="root.required ?? false"
        [invalid]="root.invalid ?? false"
        [value]="cfg.applying ? value() : undefined"
        (valueChange)="value.set($event)"
      >
        <span rindCheckboxGroupLabel>Toppings</span>
        @if (cfg.parent) {
          <div rindCheckboxGroupParent>
            <button rindCheckboxGroupItemControl></button>
            <label rindCheckboxGroupItemLabel>All toppings</label>
          </div>
        }
        @for (v of all; track v) {
          <div rindCheckboxGroupItem [value]="v" [disabled]="cfg.disabledItem === v">
            <button rindCheckboxGroupItemControl></button>
            <label rindCheckboxGroupItemLabel>{{ labels[v] }}</label>
          </div>
        }
      </div>
    </form>
  </ng-container>`,
})
class Group {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly cfg = current
  readonly root: Root = current.root ?? {}
  readonly all = ALL
  readonly labels = LABELS
  readonly value = signal<readonly string[]>([])
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

for (const { name, cfg } of [
  { name: "no Parent", cfg: {} },
  { name: "Parent", cfg: { parent: true } },
  { name: "disabled item", cfg: { disabledItem: "c" } },
  { name: "disabled group", cfg: { parent: true, root: { disabled: true } } },
  { name: "read-only group", cfg: { parent: true, root: { readonly: true } } },
  { name: "required group", cfg: { parent: true, root: { required: true } } },
  { name: "controlled, applying", cfg: { parent: true, applying: true } },
] as { name: string; cfg: Cfg }[]) {
  describe(`angular checkbox group model: ${name}`, () => {
    testMachine(checkboxGroupContract, {
      test: it,
      setup: () => {
        checkboxGroupArgs.current = { item: "a", label: "Olives" }
        current = cfg
        return mount(Group)
      },
      target: () => screen,
      anchor: [{ name: "Toppings" }] as never,
      props: {
        ...base,
        ...(cfg.parent ? { allValues: ALL } : {}),
        disabled: cfg.root?.disabled,
        readOnly: cfg.root?.readonly,
      } as never,
      a11y,
    })
  })
}

describe("Angular Checkbox Group matches React", () => {
  it("values, Parent, disabled, required, error", async () => {
    for (const cfg of [
      {},
      { parent: true, root: { defaultValue: ["a"] } },
      { parent: true, root: { defaultValue: ["a", "b", "c"] } },
      { disabledItem: "b", root: { required: true, invalid: true } },
    ] as Cfg[]) {
      current = cfg
      await both(reactGroup(cfg), Group)
    }
  })
})
