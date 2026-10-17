// Model-based tests: the Combobox contract over props classes (task 6.2). `filter={null}`
// keeps the listed options equal to the oracle's collection whatever the typed text.
import {
  type ComboboxProps,
  comboboxContract,
  comboboxIds,
  comboboxMessages,
  comboboxTraits,
  createListCollection,
  platforms,
} from "@rind-ui/core"
import { Combobox, type ComboboxRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

type Item = { key: string; label: string; disabled?: boolean }
const CITIES: readonly Item[] = ["Rome", "Paris", "Prague", "Oslo"].map((label) => ({
  key: label.toLowerCase(),
  label,
}))
const itemsOf = (items: readonly Item[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })

type Config = Pick<
  ComboboxProps,
  "autoHighlight" | "allowCustomValue" | "selectOnTab" | "readOnly" | "autoComplete"
> & { readonly multiple?: boolean; readonly items?: readonly Item[] }

function config(name: string, cfg: Config) {
  const { items = CITIES, multiple, ...rest } = cfg
  const contract = {
    ...comboboxContract,
    traits: comboboxTraits({ selectionMode: multiple ? "multiple" : "single" }),
  } as unknown as typeof comboboxContract
  const collection = itemsOf(items)
  describe(`combobox model: ${name}`, () => {
    testMachine(contract, {
      // Long paths on a loaded machine: more than the 5 s default.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () =>
        render(
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            <Combobox.Root
              items={items}
              filter={null}
              {...(rest as object)}
              {...((multiple ? { multiple: true } : {}) as ComboboxRootProps)}
            >
              <Combobox.Label>City</Combobox.Label>
              <Combobox.Control>
                <Combobox.Chips />
                <Combobox.Input />
                <Combobox.Trigger />
              </Combobox.Control>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Items />
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Root>
            <button type="button">After</button>
          </RindProvider>,
        ),
      target: () => screen,
      anchor: [{ name: "City" }],
      props: {
        items: collection,
        collection,
        ids: comboboxIds("oracle"),
        strategy: "active-descendant",
        selectionMode: multiple ? "multiple" : "single",
        locale: "en-US",
        messages: comboboxMessages,
        root: "oracle",
        // Every prop a guard reads, at its default unless the class sets it.
        disabled: undefined,
        readOnly: undefined,
        openOnInput: undefined,
        openOnArrow: undefined,
        openOnInputPress: undefined,
        openOnFocus: undefined,
        closeOnSelect: undefined,
        selectOnTab: undefined,
        keepHighlight: undefined,
        removeOnBackspace: undefined,
        ...rest,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}

config("single", {})
config("single, auto highlight", { autoHighlight: true })
config("custom value", { allowCustomValue: true })
config("select on Tab", { selectOnTab: true, autoHighlight: true })
config("read-only", { readOnly: true })
config("multiple", { multiple: true })
config("disabled neighbour", {
  items: CITIES.map((c) => (c.key === "paris" ? { ...c, disabled: true } : c)),
})
config("empty", { items: [] })
