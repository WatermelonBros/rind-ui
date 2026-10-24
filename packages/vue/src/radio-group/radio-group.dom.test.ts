// The Radio Group contract model (React's configurations) against the Vue parts, and markup
// parity with @rind-ui/react (server tab stop included).
import { createListCollection, platforms, radioGroupArgs, radioGroupContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RadioGroup, RindProvider } from "../index"

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
interface Cfg {
  readonly defaultValue?: string
  readonly disabled?: readonly string[]
  readonly root?: Record<string, unknown>
  readonly target: { readonly key: string; readonly label: string }
}
const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: SIZES,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })
const size = (cfg: Omit<Cfg, "target">) =>
  h("form", null, [
    h(
      RadioGroup.Root,
      {
        name: "size",
        ...(cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {}),
        ...cfg.root,
      },
      () => [
        h(RadioGroup.Label, null, () => "Size"),
        ...SIZES.map((s) =>
          h(
            RadioGroup.Item,
            { key: s.value, value: s.value, disabled: cfg.disabled?.includes(s.value) === true },
            () => [
              h(RadioGroup.ItemControl, null, () => h(RadioGroup.ItemIndicator)),
              h(RadioGroup.ItemLabel, null, () => s.label),
            ],
          ),
        ),
      ],
    ),
    h("button", { type: "button" }, "After"),
  ])
const reactSize = (cfg: Omit<Cfg, "target">) =>
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
  describe(`vue radio group model: ${name}`, () => {
    testMachine(radioGroupContract, {
      test: it,
      setup: () => {
        radioGroupArgs.current = cfg.target
        return mount(() =>
          h(
            RindProvider,
            { environment: { platform: currentRun()?.platform ?? platforms.linux } },
            () => size(cfg),
          ),
        )
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
        disabled: cfg.root?.["disabled"] ?? false,
        readOnly: cfg.root?.["readonly"] ?? false,
      } as never,
      a11y,
    })
  })
}

describe("Vue Radio Group matches React", () => {
  it("no value, a value, disabled, invalid", async () => {
    for (const cfg of [
      {},
      { defaultValue: "m" },
      { disabled: ["s"] },
      { root: { required: true, invalid: true } },
      { root: { orientation: "horizontal" } },
    ]) {
      await serverParity(reactSize(cfg), () => size(cfg))
      await clientParity(reactSize(cfg), () => size(cfg))
    }
  })
})
