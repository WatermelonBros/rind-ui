/** @jsxImportSource solid-js */
// The Toggle Group contract model (React's configurations, LTR and RTL) against the Solid
// parts, the lone item as a Toggle, and markup parity with @rind-ui/react.
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
import { createSignal, For, type JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, ToggleGroup, type ToggleGroupRootProps } from "../index"

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

const group = (cfg: Cfg): JSX.Element => (
  <ToggleGroup.Root aria-label="Alignment" {...(cfg.root as ToggleGroupRootProps)}>
    <For each={ITEMS}>
      {(i) => (
        <ToggleGroup.Item value={i.value} disabled={cfg.disabled?.includes(i.value) === true}>
          {i.label}
        </ToggleGroup.Item>
      )}
    </For>
  </ToggleGroup.Root>
)
const align = (cfg: Cfg) => (
  <RindProvider
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    dir={currentRun()?.direction ?? "ltr"}
  >
    {group(cfg)}
    <button type="button">After</button>
  </RindProvider>
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
const solidAlign = (cfg: Cfg) => () => (
  <div>
    {group(cfg)}
    <button type="button">After</button>
  </div>
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
  describe(`solid toggle group model: ${name}`, () => {
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

describe("solid toggle group", () => {
  it("a lone item is a toggle", async () => {
    mount(() => <ToggleGroup.Item>Bold</ToggleGroup.Item>)
    const t = getToggle(screen, { name: "Bold" })
    await t.setPressed(true)
    expect(await t.isPressed()).toBe(true)
  })

  it("controlled value", async () => {
    const [value, setValue] = createSignal<readonly string[]>(["left"])
    mount(() => (
      <ToggleGroup.Root aria-label="Alignment" value={value()} onValueChange={(v) => setValue(v)}>
        <For each={ITEMS}>
          {(i) => <ToggleGroup.Item value={i.value}>{i.label}</ToggleGroup.Item>}
        </For>
      </ToggleGroup.Root>
    ))
    // The items register on mount; the collection reaches the machine in the same flush.
    screen.getByRole("button", { name: "Right" }).click()
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Right" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    )
    expect(screen.getByRole("button", { name: "Left" }).getAttribute("aria-pressed")).toBe("false")
    expect(value()).toEqual(["right"])
  })

  it("matches React: selection and disabled", async () => {
    for (const cfg of [
      {},
      { root: { defaultValue: ["center"] } },
      { disabled: ["left"] },
      { root: { disabled: true } },
      { root: { selectionMode: "multiple", defaultValue: ["left", "right"] } },
    ]) {
      await clientParity(reactAlign(cfg), solidAlign(cfg))
    }
  })
})
