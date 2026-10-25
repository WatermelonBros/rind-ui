// The Combobox model-test helper (React's combobox-model.tsx, against the Angular parts): one
// file per props class registers its paths. `filter: null` keeps the listed options equal to
// the oracle's collection.
import { Component } from "@angular/core"
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
import { describe, it } from "vitest"
import { Combobox } from "../src/combobox/combobox"
import { RindProvider } from "../src/provider"
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

/** The configuration the next example renders. */
let current: Config = {}

/** The data items, the way React's `Combobox.Items` renders them. */
export const ITEMS = `@for (g of cb.groups(); track $index) {
          @for (i of g.items; track i.key) {
            <div rindComboboxItem [value]="i.key" [textValue]="i.label" [disabled]="i.disabled">
              <span rindComboboxItemText>{{ i.label }}</span>
            </div>
          }
        }`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Combobox],
  template: `<ng-container rindProvider [environment]="env">
    @if (cfg.inline) {
      <ng-container
        rindComboboxRoot
        #cb="rindComboboxRoot"
        inline
        [items]="items"
        [filter]="null"
        [requestClose]="cfg.closable ? close : undefined"
        [autoHighlight]="cfg.autoHighlight"
        [allowCustomValue]="cfg.allowCustomValue"
        [selectOnTab]="cfg.selectOnTab"
        [readOnly]="cfg.readOnly"
        [autoComplete]="cfg.autoComplete"
      >
        <label rindComboboxLabel>City</label>
        <div rindComboboxControl><input rindComboboxInput /></div>
        <div rindComboboxList>${ITEMS}</div>
      </ng-container>
    } @else {
      <ng-container
        rindComboboxRoot
        #cb="rindComboboxRoot"
        [items]="items"
        [filter]="null"
        [multiple]="cfg.multiple ?? false"
        [selectionMode]="cfg.freeText ? 'none' : undefined"
        [autoHighlight]="cfg.autoHighlight"
        [allowCustomValue]="cfg.allowCustomValue"
        [selectOnTab]="cfg.selectOnTab"
        [readOnly]="cfg.readOnly"
        [autoComplete]="cfg.autoComplete"
      >
        <label rindComboboxLabel>City</label>
        <div rindComboboxControl>
          <div rindComboboxChips></div>
          <input rindComboboxInput />
          <button rindComboboxTrigger></button>
        </div>
        <div rindComboboxPositioner>
          <div rindComboboxPopup><div rindComboboxList>${ITEMS}</div></div>
        </div>
      </ng-container>
    }
    <button type="button">After</button>
  </ng-container>`,
})
class Example {
  readonly cfg = current
  readonly items = current.items ?? CITIES
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly close = () => {}
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
  describe(`angular combobox model: ${name}`, () => {
    testMachine(contract, {
      // Long paths on a loaded machine: more than the 5 s default.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => {
        current = cfg
        return mount(Example)
      },
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
