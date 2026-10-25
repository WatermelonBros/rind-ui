/** @jsxImportSource solid-js */
// The Segmented Control contract model (React's configurations, LTR and RTL) against the Solid
// parts, and markup parity with @rind-ui/react.
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
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, SegmentedControl, type SegmentedControlRootProps } from "../index"

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
const range = (cfg: Cfg): JSX.Element => (
  <form>
    <SegmentedControl.Root
      name="range"
      {...(cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {})}
      {...(cfg.root as SegmentedControlRootProps)}
    >
      <SegmentedControl.Label>Range</SegmentedControl.Label>
      <For each={RANGES}>
        {(x) => (
          <SegmentedControl.Item
            value={x.value}
            disabled={cfg.disabled?.includes(x.value) === true}
          >
            {x.label}
          </SegmentedControl.Item>
        )}
      </For>
      <SegmentedControl.Indicator />
    </SegmentedControl.Root>
    <button type="button">After</button>
  </form>
)
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
  { name: "read-only", cfg: { defaultValue: "day", root: { readOnly: true } } },
  { name: "required", cfg: { root: { required: true } } },
] as { name: string; cfg: Cfg }[]) {
  describe(`solid segmented control model: ${name}`, () => {
    testMachine(segmentedControlContract, {
      test: it,
      setup: () => {
        segmentedControlArgs.current = { key: "month", label: "Month" }
        return mount(() => (
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction ?? "ltr"}
          >
            {range(cfg)}
          </RindProvider>
        ))
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
        readOnly: cfg.root?.["readOnly"] ?? false,
      } as never,
      a11y,
    })
  })
}

describe("Solid Segmented Control matches React", () => {
  it("no value, a value, disabled, vertical", async () => {
    for (const cfg of [
      {},
      { defaultValue: "week" },
      { disabled: ["day"] },
      { root: { orientation: "vertical", disabled: true } },
    ]) {
      await clientParity(reactRange(cfg), () => range(cfg))
    }
  })
})
