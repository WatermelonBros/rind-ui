/** @jsxImportSource solid-js */
// The Checkbox Group contract model (React's configurations) against the Solid parts, form
// submission and reset, and markup parity with @rind-ui/react.
import { checkboxGroupArgs, checkboxGroupContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { createSignal, For, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { CheckboxGroup, type CheckboxGroupRootProps, RindProvider } from "../index"

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
// `root` may carry getters: a spread keeps them reactive.
const group = (cfg: Cfg, root: Record<string, unknown> = {}): JSX.Element => (
  <form>
    <CheckboxGroup.Root
      name="toppings"
      {...(cfg.parent ? { allValues: ALL } : {})}
      {...(cfg.root as CheckboxGroupRootProps)}
      {...(root as CheckboxGroupRootProps)}
    >
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      {cfg.parent ? (
        <CheckboxGroup.Parent>
          <CheckboxGroup.ItemControl />
          <CheckboxGroup.ItemLabel>All toppings</CheckboxGroup.ItemLabel>
        </CheckboxGroup.Parent>
      ) : null}
      <For each={ALL}>
        {(v) => (
          <CheckboxGroup.Item value={v} disabled={cfg.disabledItem === v}>
            <CheckboxGroup.ItemControl />
            <CheckboxGroup.ItemLabel>{LABELS[v]}</CheckboxGroup.ItemLabel>
          </CheckboxGroup.Item>
        )}
      </For>
    </CheckboxGroup.Root>
    <button type="reset">Reset</button>
  </form>
)
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
    r("button", { type: "reset" }, "Reset"),
  )
/** Controlled by a parent that applies every proposal (the oracle runs it uncontrolled). */
function Applying(props: { cfg: Cfg }) {
  const [value, setValue] = createSignal<readonly string[]>([])
  return group(props.cfg, {
    get value() {
      return value()
    },
    onValueChange: (v: readonly string[]) => setValue(v),
  })
}

for (const { name, cfg, applying } of [
  { name: "no Parent", cfg: {} },
  { name: "Parent", cfg: { parent: true } },
  { name: "disabled item", cfg: { disabledItem: "c" } },
  { name: "disabled group", cfg: { parent: true, root: { disabled: true } } },
  { name: "read-only group", cfg: { parent: true, root: { readOnly: true } } },
  { name: "required group", cfg: { parent: true, root: { required: true } } },
  { name: "controlled, applying", cfg: { parent: true }, applying: true },
] as { name: string; cfg: Cfg; applying?: boolean }[]) {
  describe(`solid checkbox group model: ${name}`, () => {
    testMachine(checkboxGroupContract, {
      test: it,
      setup: () => {
        checkboxGroupArgs.current = { item: "a", label: "Olives" }
        return mount(() => (
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            {applying ? <Applying cfg={cfg} /> : group(cfg)}
          </RindProvider>
        ))
      },
      target: () => screen,
      anchor: [{ name: "Toppings" }] as never,
      props: {
        ...base,
        ...(cfg.parent ? { allValues: ALL } : {}),
        disabled: cfg.root?.["disabled"],
        readOnly: cfg.root?.["readOnly"],
      } as never,
      a11y,
    })
  })
}

describe("Solid Checkbox Group matches React", () => {
  it("values, Parent, disabled, required, error", async () => {
    for (const cfg of [
      {},
      { parent: true, root: { defaultValue: ["a"] } },
      { parent: true, root: { defaultValue: ["a", "b", "c"] } },
      { disabledItem: "b", root: { required: true, invalid: true } },
    ] as Cfg[]) {
      await clientParity(reactGroup(cfg), () => group(cfg))
    }
  })
})

describe("solid checkbox group in a form", () => {
  it("submits one entry per checked item; reset restores the default", async () => {
    mount(() => group({ root: { defaultValue: ["a"] } }))
    const form = document.querySelector("form") as HTMLFormElement
    const sent = () => new FormData(form).getAll("toppings")
    expect(sent()).toEqual(["a"])
    screen.getByRole("checkbox", { name: "Basil" }).click()
    await vi.waitFor(() => expect(sent()).toEqual(["a", "b"]))
    screen.getByRole("button", { name: "Reset" }).click()
    await vi.waitFor(() => expect(sent()).toEqual(["a"]))
  })
})
