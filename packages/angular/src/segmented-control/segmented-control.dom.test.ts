// The Segmented Control contract model (React's configurations, LTR and RTL) against the Angular
// parts, and markup parity with @rind-ui/react.
import { Component } from "@angular/core"
import {
  createListCollection,
  platforms,
  segmentedControlArgs,
  segmentedControlContract,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { SegmentedControl } from "./segmented-control"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
]
interface Root {
  readonly readonly?: boolean
  readonly required?: boolean
  readonly disabled?: boolean
  readonly orientation?: "horizontal" | "vertical"
}
interface Cfg {
  readonly defaultValue?: string
  readonly disabled?: readonly string[]
  readonly root?: Root
}
const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: RANGES,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })
/** The configuration the next fixture renders. */
let current: Cfg = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, SegmentedControl],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    <form>
      <div
        rindSegmentedControlRoot
        name="range"
        [defaultValue]="cfg.defaultValue"
        [readonly]="root.readonly ?? false"
        [required]="root.required ?? false"
        [disabled]="root.disabled ?? false"
        [orientation]="root.orientation ?? 'horizontal'"
      >
        <span rindSegmentedControlLabel>Range</span>
        @for (x of ranges; track x.value) {
          <button rindSegmentedControlItem [value]="x.value" [disabled]="off.includes(x.value)">
            {{ x.label }}
          </button>
        }
        <span rindSegmentedControlIndicator></span>
      </div>
      <button type="button">After</button>
    </form>
  </ng-container>`,
})
class Range {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly cfg = current
  readonly root: Root = current.root ?? {}
  readonly off: readonly string[] = current.disabled ?? []
  readonly ranges = RANGES
}
const reactRange = (cfg: Cfg) =>
  r(
    "form",
    null,
    r(
      R.SegmentedControl.Root,
      {
        name: "range",
        ...(cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {}),
        ...cfg.root,
      } as never,
      r(R.SegmentedControl.Label, null, "Range"),
      ...RANGES.map((x) =>
        r(
          R.SegmentedControl.Item,
          { key: x.value, value: x.value, disabled: cfg.disabled?.includes(x.value) === true },
          x.label,
        ),
      ),
      r(R.SegmentedControl.Indicator),
    ),
    r("button", { type: "button" }, "After"),
  )
for (const { name, cfg } of [
  { name: "no value", cfg: {} },
  { name: "disabled segment", cfg: { defaultValue: "day", disabled: ["week"] } },
  { name: "read-only", cfg: { defaultValue: "day", root: { readonly: true } } },
  { name: "required", cfg: { root: { required: true } } },
] as { name: string; cfg: Cfg }[]) {
  describe(`angular segmented control model: ${name}`, () => {
    testMachine(segmentedControlContract, {
      test: it,
      setup: () => {
        segmentedControlArgs.current = { key: "month", label: "Month" }
        current = cfg
        return mount(Range)
      },
      target: () => screen,
      anchor: [{ name: "Range" }] as never,
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

describe("Angular Segmented Control matches React", () => {
  it("no value, a value, disabled, vertical", async () => {
    for (const cfg of [
      {},
      { defaultValue: "week" },
      { disabled: ["day"] },
      { root: { orientation: "vertical", disabled: true } },
    ] as Cfg[]) {
      current = cfg
      await both(reactRange(cfg), Range)
    }
  })
})
