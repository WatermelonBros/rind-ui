// The Toggle Group contract model (React's configurations, LTR and RTL) against the Vue
// parts, the lone item as a Toggle, and markup parity with @rind-ui/react (server tab stop).
import {
  createListCollection,
  platforms,
  toggleGroupArgs,
  toggleGroupContract,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, getToggle, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, ToggleGroup } from "../index"

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

const align = (cfg: Cfg) =>
  h(
    RindProvider,
    {
      environment: { platform: currentRun()?.platform ?? platforms.linux },
      dir: currentRun()?.direction ?? "ltr",
    },
    () => [
      h(ToggleGroup.Root, { "aria-label": "Alignment", ...cfg.root }, () =>
        ITEMS.map((i) =>
          h(
            ToggleGroup.Item,
            { key: i.value, value: i.value, disabled: cfg.disabled?.includes(i.value) === true },
            () => i.label,
          ),
        ),
      ),
      h("button", { type: "button" }, "After"),
    ],
  )
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
const vueAlign = (cfg: Cfg) => () =>
  h("div", null, [
    h(ToggleGroup.Root, { "aria-label": "Alignment", ...cfg.root }, () =>
      ITEMS.map((i) =>
        h(
          ToggleGroup.Item,
          { key: i.value, value: i.value, disabled: cfg.disabled?.includes(i.value) === true },
          () => i.label,
        ),
      ),
    ),
    h("button", { type: "button" }, "After"),
  ])

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
  describe(`vue toggle group model: ${name}`, () => {
    testMachine(toggleGroupContract, {
      test: it,
      setup: () => {
        toggleGroupArgs.current = { key: "right", label: "Right" }
        return mount(() => align(cfg))
      },
      target: () => screen,
      anchor,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("vue toggle group", () => {
  it("a lone item is a toggle", async () => {
    mount(() => h(ToggleGroup.Item, null, () => "Bold"))
    const t = getToggle(screen, { name: "Bold" })
    await t.setPressed(true)
    expect(await t.isPressed()).toBe(true)
  })

  it("v-model", async () => {
    const view = mount(
      (p: { value: string[] }) =>
        h(
          ToggleGroup.Root,
          {
            "aria-label": "Alignment",
            modelValue: p.value,
            "onUpdate:modelValue": (v: readonly string[]) => view.rerender({ value: [...v] }),
          },
          () =>
            ITEMS.map((i) => h(ToggleGroup.Item, { key: i.value, value: i.value }, () => i.label)),
        ),
      { value: ["left"] },
    )
    // The items register on mount; the collection reaches the machine on the next flush.
    await nextTick()
    screen.getByRole("button", { name: "Right" }).click()
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Right" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    )
    expect(screen.getByRole("button", { name: "Left" }).getAttribute("aria-pressed")).toBe("false")
  })

  it("matches React: server tab stop, selection, disabled", async () => {
    for (const cfg of [
      {},
      { root: { defaultValue: ["center"] } },
      { disabled: ["left"] },
      { root: { disabled: true } },
      { root: { selectionMode: "multiple", defaultValue: ["left", "right"] } },
    ]) {
      await serverParity(reactAlign(cfg), vueAlign(cfg))
      await clientParity(reactAlign(cfg), vueAlign(cfg))
    }
  })
})
