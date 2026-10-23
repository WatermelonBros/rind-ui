// The Segmented Control contract model (React's configurations, LTR and RTL) against the Svelte
// parts, and DOM parity with @rind-ui/react.
import { createListCollection, segmentedControlArgs, segmentedControlContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Range from "../../fixtures/segmented-control/range.svelte"

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
interface Cfg {
  readonly defaultValue?: string
  readonly disabled?: readonly string[]
  readonly root?: Record<string, unknown>
}
const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: RANGES,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })
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
  describe(`svelte segmented control model: ${name}`, () => {
    testMachine(segmentedControlContract, {
      test: it,
      setup: () => {
        segmentedControlArgs.current = { key: "month", label: "Month" }
        return mount(Range, { ...cfg } as never)
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
        disabled: cfg.root?.["disabled"] ?? false,
        readOnly: cfg.root?.["readonly"] ?? false,
      } as never,
      a11y,
    })
  })
}

describe("Svelte Segmented Control matches React", () => {
  it("no value, a value, disabled, vertical", async () => {
    for (const cfg of [
      {},
      { defaultValue: "week" },
      { disabled: ["day"] },
      { root: { orientation: "vertical", disabled: true } },
    ]) {
      await clientParity(reactRange(cfg), Range, { ...cfg, provider: false } as never)
    }
  })
})
