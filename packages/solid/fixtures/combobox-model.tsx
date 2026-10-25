/** @jsxImportSource solid-js */
// The Combobox model-test helper (React's combobox-model.tsx, against the Solid parts): one
// file per props class registers its paths. `filter: null` keeps the listed options equal to
// the oracle's collection.
import {
  type ComboboxProps,
  comboboxContract,
  comboboxIds,
  comboboxInvariants,
  comboboxMessages,
  comboboxTraits,
  createListCollection,
  inlineComboboxContract,
  platforms,
} from "@rind-ui/core"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { Combobox, type ComboboxRootProps, RindProvider } from "../src/index"
import { mount } from "./mount"

export type Item = { key: string; label: string; disabled?: boolean }
export const CITIES: readonly Item[] = ["Rome", "Paris", "Prague", "Oslo"].map((label) => ({
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
> & {
  readonly multiple?: boolean
  readonly items?: readonly Item[]
  /** `selectionMode: "none"`: the text is the value (an autocomplete). */
  readonly freeText?: boolean
  /** The inline machine (a command palette); `closable`: the host closes on Escape. */
  readonly inline?: boolean
  readonly closable?: boolean
}

/** The example of one props class (the model's and the parity test's). */
export function example(cfg: Config): () => JSX.Element {
  const { items = CITIES, multiple, freeText, inline, closable, ...rest } = cfg
  // The config's optional keys hold `undefined` (exactOptionalPropertyTypes).
  const root = (extra: Record<string, unknown>) =>
    ({ items, filter: null, ...rest, ...extra }) as ComboboxRootProps
  return () => (
    <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
      {inline ? (
        <Combobox.Root {...root({ inline: true, ...(closable ? { onOpenChange: () => {} } : {}) })}>
          <Combobox.Label>City</Combobox.Label>
          <Combobox.Control>
            <Combobox.Input />
          </Combobox.Control>
          <Combobox.List>
            <Combobox.Items />
          </Combobox.List>
        </Combobox.Root>
      ) : (
        <Combobox.Root
          {...root(multiple ? { multiple: true } : freeText ? { selectionMode: "none" } : {})}
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
      )}
      <button type="button">After</button>
    </RindProvider>
  )
}

/** Registers the model test of one props class (one file per class: smaller browser runs). */
export function config(name: string, cfg: Config) {
  const { items = CITIES, multiple, freeText, inline, closable, ...rest } = cfg
  const selectionMode = inline || freeText ? "none" : multiple ? "multiple" : "single"
  // Sound: each variant's contract over the same machine setup (states from props).
  const contract = (inline
    ? inlineComboboxContract
    : {
        ...comboboxContract,
        traits: comboboxTraits({ selectionMode }),
        invariants: comboboxInvariants({ selectionMode }),
      }) as unknown as typeof comboboxContract
  const collection = itemsOf(items)
  describe(`solid combobox model: ${name}`, () => {
    testMachine(contract, {
      // Long paths on a loaded machine: more than the 5 s default.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => mount(example(cfg)),
      target: () => screen,
      anchor: [{ name: "City" }],
      props: {
        items: collection,
        collection,
        ids: comboboxIds("oracle"),
        strategy: "active-descendant",
        selectionMode,
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
        keepHighlight: inline ? true : undefined,
        autoHighlight: inline ? true : undefined,
        removeOnBackspace: undefined,
        clearOnEscape: undefined,
        page: undefined,
        onBack: undefined,
        requestClose: closable ? () => {} : undefined,
        ...rest,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}
