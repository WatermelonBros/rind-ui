// The Toggle Group contract model (React's configurations, LTR and RTL) against the Angular
// parts, two-way binding, and markup parity with @rind-ui/react (server tab stop).
import { Component, signal } from "@angular/core"
import {
  createListCollection,
  platforms,
  toggleGroupArgs,
  toggleGroupContract,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { ToggleGroup } from "./toggle-group"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const ITEMS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
]
const anchor = [{ name: "Alignment" }] as never
interface Root {
  readonly selectionMode?: "single" | "multiple"
  readonly disallowEmptySelection?: boolean
  readonly defaultValue?: readonly string[]
  readonly orientation?: "horizontal" | "vertical"
  readonly disabled?: boolean
}
interface Cfg {
  readonly root?: Root
  readonly disabled?: readonly string[]
}
const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: ITEMS,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })

/** The configuration the next fixture renders (a server render cannot set inputs). */
let current: Cfg = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, ToggleGroup],
  template: `<ng-container rindProvider [environment]="env" [dir]="dir">
    <div>
      <div
        rindToggleGroupRoot
        aria-label="Alignment"
        [selectionMode]="root.selectionMode ?? 'single'"
        [disallowEmptySelection]="root.disallowEmptySelection ?? false"
        [defaultValue]="root.defaultValue"
        [orientation]="root.orientation ?? 'horizontal'"
        [disabled]="root.disabled ?? false"
      >
        @for (i of items; track i.value) {
          <button rindToggleGroupItem [value]="i.value" [disabled]="off.includes(i.value)">
            {{ i.label }}
          </button>
        }
      </div>
      <button type="button">After</button>
    </div>
  </ng-container>`,
})
class Align {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly root: Root = current.root ?? {}
  readonly off: readonly string[] = current.disabled ?? []
  readonly items = ITEMS
}
const reactAlign = (cfg: Cfg) =>
  r(
    "div",
    null,
    r(
      R.ToggleGroup.Root,
      { "aria-label": "Alignment", ...cfg.root },
      ITEMS.map((i) =>
        r(
          R.ToggleGroup.Item,
          { key: i.value, value: i.value, disabled: cfg.disabled?.includes(i.value) === true },
          i.label,
        ),
      ),
    ),
    r("button", { type: "button" }, "After"),
  )

const configs: { name: string; cfg: Cfg }[] = [
  { name: "single", cfg: {} },
  { name: "multiple", cfg: { root: { selectionMode: "multiple" } } },
  {
    name: "disallowEmptySelection",
    cfg: { root: { disallowEmptySelection: true, defaultValue: ["right"] } },
  },
  { name: "vertical", cfg: { root: { orientation: "vertical" } } },
]
const propsOf = (cfg: Cfg) => ({
  collection: collectionOf(cfg.disabled),
  strategy: "roving",
  ids: { list: "root", item: (k: string) => `item-${k}` },
  loop: true,
  selectionMode: cfg.root?.selectionMode ?? "single",
  disallowEmptySelection: cfg.root?.disallowEmptySelection ?? false,
  focusableWhenDisabled: false,
  value: undefined,
  defaultValue: cfg.root?.defaultValue,
  onValueChange: undefined,
  disabled: false,
})

for (const { name, cfg } of configs) {
  describe(`angular toggle group model: ${name}`, () => {
    testMachine(toggleGroupContract, {
      test: it,
      setup: () => {
        toggleGroupArgs.current = { key: "right", label: "Right" }
        current = cfg
        return mount(Align)
      },
      target: () => screen,
      anchor,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

@Component({
  imports: [ToggleGroup],
  template: `<div rindToggleGroupRoot aria-label="Alignment" [(value)]="value">
    @for (i of items; track i.value) {
      <button rindToggleGroupItem [value]="i.value">{{ i.label }}</button>
    }
  </div>`,
})
class Bound {
  readonly value = signal<readonly string[]>(["left"])
  readonly items = ITEMS
}

describe("angular toggle group", () => {
  it("[(value)]", async () => {
    const { ref } = await mount(Bound)
    screen.getByRole("button", { name: "Right" }).click()
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Right" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    )
    expect(screen.getByRole("button", { name: "Left" }).getAttribute("aria-pressed")).toBe("false")
    expect(ref.instance.value()).toEqual(["right"])
  })

  it("matches React: server tab stop, selection, disabled", async () => {
    const cfgs: Cfg[] = [
      {},
      { root: { defaultValue: ["center"] } },
      { disabled: ["left"] },
      { root: { disabled: true } },
      { root: { selectionMode: "multiple", defaultValue: ["left", "right"] } },
    ]
    for (const cfg of cfgs) {
      current = cfg
      await both(reactAlign(cfg), Align)
    }
  })
})
