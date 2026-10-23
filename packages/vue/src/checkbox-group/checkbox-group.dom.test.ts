// The Checkbox Group contract model (React's configurations) against the Vue parts, and markup
// parity with @rind-ui/react.
import { checkboxGroupArgs, checkboxGroupContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { defineComponent, h, ref } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { CheckboxGroup, RindProvider } from "../index"

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
const group = (cfg: Cfg, root: Record<string, unknown> = {}) =>
  h("form", null, [
    h(
      CheckboxGroup.Root,
      { name: "toppings", ...(cfg.parent ? { allValues: ALL } : {}), ...cfg.root, ...root },
      () => [
        h(CheckboxGroup.Label, null, () => "Toppings"),
        cfg.parent
          ? h(CheckboxGroup.Parent, null, () => [
              h(CheckboxGroup.ItemControl),
              h(CheckboxGroup.ItemLabel, null, () => "All toppings"),
            ])
          : null,
        ...ALL.map((v) =>
          h(CheckboxGroup.Item, { key: v, value: v, disabled: cfg.disabledItem === v }, () => [
            h(CheckboxGroup.ItemControl),
            h(CheckboxGroup.ItemLabel, null, () => LABELS[v]),
          ]),
        ),
      ],
    ),
  ])
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
/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
const Applying = defineComponent({
  props: { cfg: { type: Object as () => Cfg, required: true } },
  setup(props) {
    const value = ref<readonly string[]>([])
    return () =>
      group(props.cfg, {
        modelValue: value.value,
        "onUpdate:modelValue": (v: readonly string[]) => (value.value = v),
      })
  },
})

for (const { name, cfg, applying } of [
  { name: "no Parent", cfg: {} },
  { name: "Parent", cfg: { parent: true } },
  { name: "disabled item", cfg: { disabledItem: "c" } },
  { name: "disabled group", cfg: { parent: true, root: { disabled: true } } },
  { name: "read-only group", cfg: { parent: true, root: { readonly: true } } },
  { name: "required group", cfg: { parent: true, root: { required: true } } },
  { name: "controlled, applying", cfg: { parent: true }, applying: true },
] as { name: string; cfg: Cfg; applying?: boolean }[]) {
  describe(`vue checkbox group model: ${name}`, () => {
    testMachine(checkboxGroupContract, {
      test: it,
      setup: () => {
        checkboxGroupArgs.current = { item: "a", label: "Olives" }
        return mount(() =>
          h(
            RindProvider,
            { environment: { platform: currentRun()?.platform ?? platforms.linux } },
            () => (applying ? h(Applying, { cfg }) : group(cfg)),
          ),
        )
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

describe("Vue Checkbox Group matches React", () => {
  it("values, Parent, disabled, required, error", async () => {
    for (const cfg of [
      {},
      { parent: true, root: { defaultValue: ["a"] } },
      { parent: true, root: { defaultValue: ["a", "b", "c"] } },
      { disabledItem: "b", root: { required: true, invalid: true } },
    ] as Cfg[]) {
      const toReact = { ...cfg, ...(cfg.root ? { root: { ...cfg.root } } : {}) }
      await serverParity(reactGroup(toReact), () => group(cfg))
      await clientParity(reactGroup(toReact), () => group(cfg))
    }
  })
})
