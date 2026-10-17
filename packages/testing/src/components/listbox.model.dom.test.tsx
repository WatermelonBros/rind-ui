// Model-based tests: the Listbox contract over the props classes of the spec (task 5.2):
// single/multiple × toggle/replace, none with onAction, horizontal under rtl; all modalities.
import {
  createListCollection,
  type ListboxProps,
  listboxContract,
  listboxIds,
  listboxTraits,
  platforms,
} from "@rind-ui/core"
import { Listbox, type ListboxRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const FRUITS = ["Apple", "Banana", "Cherry", "Date", "Elderberry"].map((label) => ({
  key: label.toLowerCase(),
  label,
}))
const itemsOf = (
  items: readonly {
    key: string
    label: string
    disabled?: boolean
    section?: { key: string; label: string }
  }[],
) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const collection = itemsOf(FRUITS)

type Config = Pick<
  ListboxProps,
  "selectionMode" | "selectionBehavior" | "orientation" | "loading"
> & {
  readonly items?: readonly {
    key: string
    label: string
    disabled?: boolean
    section?: { key: string; label: string }
  }[]
}

function config(name: string, cfg: Config) {
  // A horizontal list moves with ArrowRight (the runner mirrors it under rtl).
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
  } as ListboxRootProps
  describe(`listbox model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        render(
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
          >
            <Listbox.Root items={cfg.items ?? FRUITS} {...root}>
              <Listbox.Label>Fruit</Listbox.Label>
              <Listbox.List>
                <Listbox.Items />
              </Listbox.List>
            </Listbox.Root>
            <button type="button">After</button>
          </RindProvider>,
        ),
      target: () => screen,
      anchor: [{ name: "Fruit" }],
      props: {
        collection: cfg.items ? itemsOf(cfg.items) : collection,
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
// Argument classes from collections: sections, a disabled neighbour, empty, loading.
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
