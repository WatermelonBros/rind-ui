// The Toggle Group contract model (React's configurations, LTR and RTL) against the Svelte
// parts, the lone item as a Toggle, bind:value, and DOM parity with @rind-ui/react.
import { createListCollection, toggleGroupArgs, toggleGroupContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getToggle, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Align from "../../fixtures/toggle-group/align.svelte"
import Lone from "../../fixtures/toggle-group/lone.svelte"

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
interface Cfg {
  readonly root?: Record<string, unknown>
  readonly disabled?: readonly string[]
}
const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: ITEMS,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })
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
  selectionMode: cfg.root?.["selectionMode"] ?? "single",
  disallowEmptySelection: cfg.root?.["disallowEmptySelection"] ?? false,
  focusableWhenDisabled: false,
  value: undefined,
  defaultValue: cfg.root?.["defaultValue"],
  onValueChange: undefined,
  disabled: false,
})

for (const { name, cfg } of configs) {
  describe(`svelte toggle group model: ${name}`, () => {
    testMachine(toggleGroupContract, {
      test: it,
      setup: () => {
        toggleGroupArgs.current = { key: "right", label: "Right" }
        return mount(Align, { ...cfg } as never)
      },
      target: () => screen,
      anchor,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("svelte toggle group", () => {
  it("a lone item is a toggle", async () => {
    mount(Lone)
    const t = getToggle(screen, { name: "Bold" })
    await t.setPressed(true)
    expect(await t.isPressed()).toBe(true)
  })

  it("bind:value", async () => {
    mount(Align, { value: ["left"] } as never)
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Left" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    )
    screen.getByRole("button", { name: "Right" }).click()
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Right" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    )
    expect(screen.getByRole("button", { name: "Left" }).getAttribute("aria-pressed")).toBe("false")
  })

  it("matches React: selection, disabled", async () => {
    for (const cfg of [
      {},
      { root: { defaultValue: ["center"] } },
      { disabled: ["left"] },
      { root: { disabled: true } },
      { root: { selectionMode: "multiple", defaultValue: ["left", "right"] } },
    ]) {
      await clientParity(reactAlign(cfg), Align, { ...cfg, provider: false } as never)
    }
  })
})
