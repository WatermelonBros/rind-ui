// The Tabs contract model (React's matrix) against the Svelte parts, and DOM parity.
import { createListCollection, tabsArgs, tabsContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Settings from "../../fixtures/tabs/settings.svelte"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const TABS = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "team", label: "Team" },
]
interface Cfg {
  readonly root?: Record<string, unknown>
  readonly disabled?: readonly string[]
}
const reactTree = (cfg: Cfg) =>
  r(
    R.Tabs.Root,
    (cfg.root ?? {}) as never,
    r(
      R.Tabs.List,
      { "aria-label": "Settings" },
      TABS.map((t) =>
        r(
          R.Tabs.Tab,
          { key: t.value, value: t.value, disabled: cfg.disabled?.includes(t.value) === true },
          t.label,
        ),
      ),
    ),
    TABS.map((t) => r(R.Tabs.Panel, { key: t.value, value: t.value }, `${t.label} settings`)),
  )
const configs: { name: string; cfg: Cfg }[] = [
  { name: "no default", cfg: {} },
  { name: "first disabled", cfg: { disabled: ["general"] } },
  { name: "selected disabled", cfg: { root: { defaultValue: "billing" }, disabled: ["billing"] } },
  { name: "all disabled", cfg: { disabled: ["general", "billing", "team"] } },
  { name: "vertical", cfg: { root: { orientation: "vertical" } } },
  { name: "manual", cfg: { root: { activationMode: "manual" } } },
  { name: "until-found", cfg: { root: { inactivePanels: "until-found" } } },
]
const propsOf = (cfg: Cfg) => ({
  collection: createListCollection({
    items: TABS,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => cfg.disabled?.includes(i.value) === true,
  }),
  strategy: "roving",
  ids: { list: "list", item: (k: string) => `tab-${k}` },
  loop: true,
  focusableWhenDisabled: false,
  value: undefined,
  defaultValue:
    cfg.root?.["defaultValue"] ?? TABS.find((t) => !cfg.disabled?.includes(t.value))?.value,
  onValueChange: undefined,
  activationMode: cfg.root?.["activationMode"] ?? "automatic",
  disabled: false,
})

for (const { name, cfg } of configs) {
  describe(`svelte tabs model: ${name}`, () => {
    testMachine(tabsContract, {
      test: it,
      setup: () => {
        tabsArgs.current = { key: "team", label: "Team" }
        return mount(Settings, { root: cfg.root ?? {}, disabled: cfg.disabled ?? [] } as never)
      },
      target: () => screen,
      anchor: [{ name: "Settings" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Svelte Tabs match React", () => {
  it("configurations", async () => {
    for (const { cfg } of [
      ...configs,
      { cfg: { root: { defaultValue: "team", inactivePanels: "hidden" } } as Cfg },
    ]) {
      await clientParity(reactTree(cfg), Settings, {
        root: cfg.root ?? {},
        disabled: cfg.disabled ?? [],
        provider: false,
      } as never)
    }
  })
})
