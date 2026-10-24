// The Radio Group contract model (React's configurations) against the Angular parts, and markup
// parity with @rind-ui/react (server tab stop included).
import { Component } from "@angular/core"
import { createListCollection, platforms, radioGroupArgs, radioGroupContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { RadioGroup } from "./radio-group"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const SIZES = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
]
interface Root {
  readonly readonly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  readonly disabled?: boolean
  readonly orientation?: "vertical" | "horizontal"
}
interface Cfg {
  readonly defaultValue?: string
  readonly disabled?: readonly string[]
  readonly root?: Root
  readonly target?: { readonly key: string; readonly label: string }
}
const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: SIZES,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })
/** The configuration the next fixture renders. */
let current: Cfg = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, RadioGroup],
  template: `<ng-container rindProvider [environment]="env">
    <form>
      <div
        rindRadioGroupRoot
        name="size"
        [defaultValue]="cfg.defaultValue"
        [readonly]="root.readonly ?? false"
        [required]="root.required ?? false"
        [invalid]="root.invalid ?? false"
        [disabled]="root.disabled ?? false"
        [orientation]="root.orientation ?? 'vertical'"
      >
        <span rindRadioGroupLabel>Size</span>
        @for (s of sizes; track s.value) {
          <div rindRadioGroupItem [value]="s.value" [disabled]="off.includes(s.value)">
            <button rindRadioGroupItemControl><span rindRadioGroupItemIndicator></span></button>
            <label rindRadioGroupItemLabel>{{ s.label }}</label>
          </div>
        }
      </div>
      <button type="button">After</button>
    </form>
  </ng-container>`,
})
class Size {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly cfg = current
  readonly root: Root = current.root ?? {}
  readonly off: readonly string[] = current.disabled ?? []
  readonly sizes = SIZES
}
const reactSize = (cfg: Cfg) =>
  r(
    "form",
    null,
    r(
      R.RadioGroup.Root,
      {
        name: "size",
        ...(cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {}),
        ...cfg.root,
      } as never,
      r(R.RadioGroup.Label, null, "Size"),
      ...SIZES.map((s) =>
        r(
          R.RadioGroup.Item,
          { key: s.value, value: s.value, disabled: cfg.disabled?.includes(s.value) === true },
          r(R.RadioGroup.ItemControl, null, r(R.RadioGroup.ItemIndicator)),
          r(R.RadioGroup.ItemLabel, null, s.label),
        ),
      ),
    ),
    r("button", { type: "button" }, "After"),
  )
const LARGE = { key: "l", label: "Large" }
for (const { name, cfg } of [
  { name: "no value", cfg: { target: LARGE } },
  { name: "first disabled", cfg: { disabled: ["s"], target: LARGE } },
  { name: "checked disabled", cfg: { defaultValue: "s", disabled: ["s"], target: LARGE } },
  { name: "read-only", cfg: { defaultValue: "s", root: { readonly: true }, target: LARGE } },
  { name: "required", cfg: { root: { required: true }, target: LARGE } },
] as { name: string; cfg: Cfg }[]) {
  describe(`angular radio group model: ${name}`, () => {
    testMachine(radioGroupContract, {
      test: it,
      setup: () => {
        radioGroupArgs.current = cfg.target ?? LARGE
        current = cfg
        return mount(Size)
      },
      target: () => screen,
      anchor: [{ name: "Size" }] as never,
      props: {
        collection: collectionOf(cfg.disabled),
        strategy: "roving",
        ids: { list: "root", item: (k: string) => `item-${k}` },
        loop: true,
        selectionMode: "single",
        focusableWhenDisabled: false,
        value: undefined,
        defaultValue: cfg.defaultValue,
        onValueChange: undefined,
        disabled: cfg.root?.disabled ?? false,
        readOnly: cfg.root?.readonly ?? false,
      } as never,
      a11y,
    })
  })
}

describe("Angular Radio Group matches React", () => {
  it("no value, a value, disabled, invalid", async () => {
    for (const cfg of [
      {},
      { defaultValue: "m" },
      { disabled: ["s"] },
      { root: { required: true, invalid: true } },
      { root: { orientation: "horizontal" } },
    ] as Cfg[]) {
      current = cfg
      await both(reactSize(cfg), Size)
    }
  })
})
