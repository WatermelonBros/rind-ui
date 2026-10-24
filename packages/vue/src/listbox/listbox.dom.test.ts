// The Listbox contract model (React's matrix) against the Vue parts, and markup parity
// (data items, sections, static items with descriptions and indicators, empty).
import {
  createListCollection,
  type ListboxProps,
  listboxContract,
  listboxIds,
  listboxTraits,
  platforms,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Listbox, RindProvider } from "../index"

type Item = {
  key: string
  label: string
  disabled?: boolean
  section?: { key: string; label: string }
}
const FRUITS: Item[] = ["Apple", "Banana", "Cherry", "Date", "Elderberry"].map((label) => ({
  key: label.toLowerCase(),
  label,
}))
const itemsOf = (items: readonly Item[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
type Config = Pick<
  ListboxProps,
  "selectionMode" | "selectionBehavior" | "orientation" | "loading"
> & { readonly items?: readonly Item[] }
const list = (items: readonly Item[], root: Record<string, unknown>) =>
  h(Listbox.Root, { items, ...root }, () => [
    h(Listbox.Label, null, () => "Fruit"),
    h(Listbox.List, null, () => h(Listbox.Items)),
  ])
const reactList = (items: readonly Item[], root: Record<string, unknown>) =>
  r(
    R.Listbox.Root,
    { items, ...root } as never,
    r(R.Listbox.Label, null, "Fruit"),
    r(R.Listbox.List, null, r(R.Listbox.Items)),
  )

function config(name: string, cfg: Config) {
  const horizontal = cfg.orientation === "horizontal"
  const contract = {
    ...listboxContract,
    traits: listboxTraits(cfg),
    actions: {
      ...listboxContract.actions,
      ...(horizontal
        ? {
            next: {
              ...listboxContract.actions.next,
              keyboard: (env: { keyboard(k: string): Promise<void> }) => env.keyboard("ArrowRight"),
            },
          }
        : {}),
    },
  } as unknown as typeof listboxContract
  const { items: _items, ...props } = cfg
  const root = {
    ...props,
    ...(cfg.selectionMode === "none" || cfg.selectionBehavior === "replace"
      ? { onAction: () => {} }
      : {}),
  }
  describe(`vue listbox model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        mount(() =>
          h(
            RindProvider,
            {
              environment: { platform: currentRun()?.platform ?? platforms.linux },
              dir: currentRun()?.direction === "rtl" ? "rtl" : "ltr",
            },
            () => [list(cfg.items ?? FRUITS, root), h("button", { type: "button" }, "After")],
          ),
        ),
      target: () => screen,
      anchor: [{ name: "Fruit" }],
      props: {
        collection: itemsOf(cfg.items ?? FRUITS),
        loading: cfg.loading,
        ids: listboxIds("listbox", "oracle"),
        strategy: "roving",
        selectionMode: cfg.selectionMode ?? "single",
        selectionBehavior: cfg.selectionBehavior,
        orientation: cfg.orientation,
        onAction: () => {},
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}
config("single toggle", { selectionMode: "single" })
config("single replace", { selectionMode: "single", selectionBehavior: "replace" })
config("multiple toggle", { selectionMode: "multiple" })
config("multiple replace", { selectionMode: "multiple", selectionBehavior: "replace" })
config("none with onAction", { selectionMode: "none" })
config("horizontal (ltr and rtl)", { selectionMode: "single", orientation: "horizontal" })
config("sections", {
  selectionMode: "multiple",
  items: FRUITS.map((f, i) => ({
    ...f,
    section: i < 2 ? { key: "a", label: "First" } : { key: "b", label: "Second" },
  })),
})
config("disabled neighbour", {
  selectionMode: "multiple",
  items: FRUITS.map((f) => (f.key === "banana" ? { ...f, disabled: true } : f)),
})
config("empty", { selectionMode: "single", items: [] })
config("loading more (async)", { selectionMode: "single", loading: "loading-more" })

describe("Vue Listbox matches React", () => {
  it("data, sections, selected, static parts, empty", async () => {
    for (const [items, root] of [
      [FRUITS, {}],
      [
        FRUITS.map((f, i) => ({
          ...f,
          section: i < 2 ? { key: "a", label: "First" } : { key: "b", label: "Second" },
        })),
        { selectionMode: "multiple" },
      ],
      [FRUITS, { defaultValue: "cherry" }],
      [[], {}],
    ] as const) {
      await serverParity(reactList(items, root), () => list(items, root))
      await clientParity(reactList(items, root), () => list(items, root))
    }
    const vueStatic = () =>
      h(Listbox.Root, { defaultValue: "a" }, () => [
        h(Listbox.Label, null, () => "Letters"),
        h(Listbox.List, null, () =>
          ["a", "b"].map((k) =>
            h(Listbox.Item, { key: k, value: k }, () => [
              h(Listbox.ItemText, null, () => k.toUpperCase()),
              h(Listbox.ItemDescription, null, () => `The letter ${k}`),
              h(Listbox.ItemIndicator, null, () => "✓"),
            ]),
          ),
        ),
        h(Listbox.Empty, null, () => "Nothing"),
      ])
    const reactStatic = r(
      R.Listbox.Root,
      { defaultValue: "a" },
      r(R.Listbox.Label, null, "Letters"),
      r(
        R.Listbox.List,
        null,
        ["a", "b"].map((k) =>
          r(
            R.Listbox.Item,
            { key: k, value: k },
            r(R.Listbox.ItemText, null, k.toUpperCase()),
            r(R.Listbox.ItemDescription, null, `The letter ${k}`),
            r(R.Listbox.ItemIndicator, null, "✓"),
          ),
        ),
      ),
      r(R.Listbox.Empty, null, "Nothing"),
    )
    await clientParity(reactStatic, vueStatic)
  })
})
