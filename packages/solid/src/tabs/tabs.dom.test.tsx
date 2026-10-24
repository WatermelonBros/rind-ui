/** @jsxImportSource solid-js */
// The Tabs contract model (React's matrix) against the Solid parts, and markup parity.
import { createListCollection, platforms, tabsArgs, tabsContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, Tabs, type TabsRootProps } from "../index"

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
const tree = (cfg: Cfg): JSX.Element => (
  <Tabs.Root {...((cfg.root ?? {}) as TabsRootProps)}>
    <Tabs.List aria-label="Settings">
      <For each={TABS}>
        {(t) => (
          <Tabs.Tab value={t.value} disabled={cfg.disabled?.includes(t.value) === true}>
            {t.label}
          </Tabs.Tab>
        )}
      </For>
    </Tabs.List>
    <For each={TABS}>{(t) => <Tabs.Panel value={t.value}>{t.label} settings</Tabs.Panel>}</For>
  </Tabs.Root>
)
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
  describe(`solid tabs model: ${name}`, () => {
    testMachine(tabsContract, {
      test: it,
      setup: () => {
        tabsArgs.current = { key: "team", label: "Team" }
        return mount(() => (
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction ?? "ltr"}
          >
            {tree(cfg)}
            <button type="button">After</button>
          </RindProvider>
        ))
      },
      target: () => screen,
      anchor: [{ name: "Settings" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Solid Tabs match React", () => {
  it("configurations", async () => {
    for (const { cfg } of [
      ...configs,
      { cfg: { root: { defaultValue: "team", inactivePanels: "hidden" } } as Cfg },
    ]) {
      await clientParity(reactTree(cfg), () => tree(cfg))
    }
  })
})
