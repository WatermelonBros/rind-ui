// The Tags Input contract model (React's props classes) against the Angular parts, and markup
// parity with React: empty, with tags, in a form, read-only, suggestions open.
import { Component } from "@angular/core"
import {
  createListCollection,
  platforms,
  type TagsInputProps,
  tagsInputContract,
  tagsInputIds,
  tagsInputInvariants,
  tagsInputMessages,
  tagsInputTraits,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both, clientParity } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { TagsInput } from "./tags-input"

type Config = Pick<
  TagsInputProps,
  "allowDuplicates" | "max" | "blurBehavior" | "editable" | "readOnly" | "defaultValue"
> & { readonly refuse?: boolean; readonly suggestions?: boolean }
interface P {
  readonly id?: string
  readonly defaultValue?: readonly string[]
  readonly defaultInputValue?: string
  readonly name?: string
  readonly inputName?: string
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly max?: number
  readonly required?: boolean
  readonly allowDuplicates?: boolean
  readonly blurBehavior?: "keep" | "add" | "clear"
  readonly editable?: boolean
  readonly items?: readonly { key: string; label: string }[]
}
const TOPICS = ["Rome", "Paris", "Oslo"].map((label) => ({ key: label.toLowerCase(), label }))
const topics = createListCollection({
  items: TOPICS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})
const none = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})
/** The configuration the next fixture renders. */
let current: {
  p: P
  suggestions: boolean
  provider: boolean
  validate?: (() => string) | undefined
  filterNull?: boolean
} = { p: {}, suggestions: false, provider: false }

const ITEMS = `@for (g of t.groups(); track $index) {
            @for (i of g.items; track i.key) {
              <div rindTagsInputItem [value]="i.key" [textValue]="i.label" [disabled]="i.disabled">
                <span rindTagsInputItemText>{{ i.label }}</span>
              </div>
            }
          }`
const ROOT = `<ng-container
      rindTagsInputRoot
      #t="rindTagsInputRoot"
      [id]="p.id"
      [defaultValue]="p.defaultValue"
      [defaultInputValue]="p.defaultInputValue"
      [name]="p.name"
      [inputName]="p.inputName"
      [readOnly]="p.readOnly"
      [disabled]="p.disabled"
      [max]="p.max"
      [required]="p.required"
      [allowDuplicates]="p.allowDuplicates"
      [blurBehavior]="p.blurBehavior"
      [editable]="p.editable"
      [items]="p.items"
      [validate]="validate"
      [filter]="filterNull ? null : undefined"
    >
      <label rindTagsInputLabel>Tags</label>
      <div rindTagsInputControl>
        <div rindTagsInputChips></div>
        <input rindTagsInputInput />
        <button rindTagsInputClearTrigger></button>
      </div>
      @if (suggestions) {
        <div rindTagsInputPositioner>
          <div rindTagsInputPopup><div rindTagsInputList>${ITEMS}</div></div>
        </div>
      }
    </ng-container>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, TagsInput],
  template: `@if (provider) {
      <ng-container rindProvider [environment]="env">
        ${ROOT}
        <button type="button">After</button>
      </ng-container>
    } @else {
      <div>${ROOT}</div>
    }`,
})
class Example {
  readonly p = current.p
  readonly suggestions = current.suggestions
  readonly provider = current.provider
  readonly validate = current.validate
  readonly filterNull = current.filterNull === true
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
}

const reactParts = (suggestions: boolean) => [
  r(R.TagsInput.Label, { key: "l" }, "Tags"),
  r(
    R.TagsInput.Control,
    { key: "c" },
    r(R.TagsInput.Chips),
    r(R.TagsInput.Input),
    r(R.TagsInput.ClearTrigger),
  ),
  suggestions
    ? r(
        R.TagsInput.Positioner,
        { key: "p" },
        r(R.TagsInput.Popup, null, r(R.TagsInput.List, null, r(R.TagsInput.Items))),
      )
    : null,
]

function config(name: string, cfg: Config) {
  const { refuse, suggestions, ...rest } = cfg
  const validate = refuse ? () => "nope" : undefined
  const items = suggestions ? topics : undefined
  // Sound: the same contract with the traits and invariants of the props class.
  const contract = {
    ...tagsInputContract,
    traits: tagsInputTraits({ items }),
    invariants: tagsInputInvariants({ items }),
  } as unknown as typeof tagsInputContract
  describe(`angular tags-input model: ${name}`, () => {
    testMachine(contract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => {
        current = {
          p: { ...rest, ...(suggestions ? { items: TOPICS } : {}) } as P,
          suggestions: suggestions === true,
          provider: true,
          validate,
          // filter null: the listed suggestions stay the oracle's collection.
          filterNull: suggestions === true,
        }
        return mount(Example)
      },
      target: () => screen,
      anchor: [{ name: "Tags" }],
      props: {
        locale: "en-US",
        messages: tagsInputMessages,
        items,
        collection: items ?? none,
        ids: tagsInputIds("oracle"),
        strategy: "active-descendant",
        root: "oracle",
        // Every prop a guard reads, at its default unless the class sets it.
        disabled: undefined,
        readOnly: undefined,
        editable: undefined,
        removeOnBackspace: undefined,
        addOnPaste: undefined,
        pasteDelimiter: undefined,
        blurBehavior: undefined,
        disabledKeys: undefined,
        allowDuplicates: undefined,
        normalize: undefined,
        textOf: undefined,
        closeOnSelect: undefined,
        keepHighlight: undefined,
        validate,
        ...rest,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}
config("default", {})
config("with tags", { defaultValue: ["a", "b"] })
config("duplicates allowed", { allowDuplicates: true, defaultValue: ["a"] })
config("max 1", { max: 1 })
config("refusing", { refuse: true })
config("blur add", { blurBehavior: "add" })
config("blur clear", { blurBehavior: "clear" })
config("read-only", { readOnly: true, defaultValue: ["a"] })
// Duplicates allowed: a chosen suggestion stays listed, as in the oracle's collection.
config("suggestions", { suggestions: true, allowDuplicates: true })

describe("Angular TagsInput matches React", () => {
  for (const p of [
    {},
    { defaultValue: ["a", "b"], name: "tags", inputName: "draft" },
    { readOnly: true, defaultValue: ["a"] },
    { disabled: true, defaultValue: ["a"] },
    { max: 1, defaultValue: ["a"], required: true },
  ] as P[]) {
    it(`empty, tags, read-only, disabled, max ${JSON.stringify(p)}`, async () => {
      const own = { id: "tags", ...p }
      current = { p: own, suggestions: false, provider: false }
      await both(r("div", null, r(R.TagsInput.Root, own as never, ...reactParts(false))), Example)
    })
  }
  for (const p of [{}, { defaultValue: ["rome"] }, { defaultInputValue: "o" }] as P[]) {
    it(`suggestions ${JSON.stringify(p)}`, async () => {
      const own = { id: "tags", items: TOPICS, ...p }
      current = { p: own, suggestions: true, provider: false }
      await clientParity(
        r("div", null, r(R.TagsInput.Root, own as never, ...reactParts(true))),
        Example,
      )
    })
  }
})
