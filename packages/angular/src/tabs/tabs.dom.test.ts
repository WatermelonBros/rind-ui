// The Tabs contract model (React's matrix) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import {
  createListCollection,
  type InactivePanels,
  platforms,
  tabsArgs,
  tabsContract,
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
import { Tabs } from "./tabs"

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
  readonly root?: {
    readonly defaultValue?: string
    readonly orientation?: "horizontal" | "vertical"
    readonly activationMode?: "automatic" | "manual"
    readonly inactivePanels?: InactivePanels
  }
  readonly disabled?: readonly string[]
}
/** The configuration the next fixture renders. */
let current: Cfg = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Tabs],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    <div
      rindTabsRoot
      [defaultValue]="root.defaultValue"
      [orientation]="root.orientation ?? 'horizontal'"
      [activationMode]="root.activationMode ?? 'automatic'"
      [inactivePanels]="root.inactivePanels ?? 'unmount'"
    >
      <div rindTabsList aria-label="Settings">
        @for (t of tabs; track t.value) {
          <button rindTabsTab [value]="t.value" [disabled]="off(t.value)">{{ t.label }}</button>
        }
      </div>
      @for (t of tabs; track t.value) {
        <div rindTabsPanel [value]="t.value">{{ t.label }} settings</div>
      }
    </div>
    @if (after) {
      <button type="button">After</button>
    }
  </ng-container>`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly root = current.root ?? {}
  readonly cfg = current
  readonly tabs = TABS
  readonly after = currentRun() !== undefined
  off(value: string) {
    return this.cfg.disabled?.includes(value) === true
  }
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
  defaultValue: cfg.root?.defaultValue ?? TABS.find((t) => !cfg.disabled?.includes(t.value))?.value,
  onValueChange: undefined,
  activationMode: cfg.root?.activationMode ?? "automatic",
  disabled: false,
})

for (const { name, cfg } of configs) {
  describe(`angular tabs model: ${name}`, () => {
    testMachine(tabsContract, {
      test: it,
      setup: () => {
        tabsArgs.current = { key: "team", label: "Team" }
        current = cfg
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Settings" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Angular Tabs match React", () => {
  it("configurations", async () => {
    for (const { cfg } of [
      ...configs,
      { cfg: { root: { defaultValue: "team", inactivePanels: "hidden" } } as Cfg },
    ]) {
      current = cfg
      await both(reactTree(cfg), Tree)
    }
  })
})
