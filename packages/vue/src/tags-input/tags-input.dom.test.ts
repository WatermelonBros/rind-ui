// The Tags Input contract model (React's props classes) against the Vue parts, and markup
// parity with React: empty, with tags, in a form, read-only, suggestions open.
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
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, TagsInput } from "../index"

type Config = Pick<
  TagsInputProps,
  "allowDuplicates" | "max" | "blurBehavior" | "editable" | "readOnly" | "defaultValue"
> & { readonly refuse?: boolean; readonly suggestions?: boolean }

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

type P = Record<string, unknown>
const parts = (suggestions: boolean) => [
  h(TagsInput.Label, null, () => "Tags"),
  h(TagsInput.Control, null, () => [
    h(TagsInput.Chips),
    h(TagsInput.Input),
    h(TagsInput.ClearTrigger),
  ]),
  suggestions
    ? h(TagsInput.Positioner, null, () =>
        h(TagsInput.Popup, null, () => h(TagsInput.List, null, () => h(TagsInput.Items))),
      )
    : null,
]
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
  describe(`vue tags-input model: ${name}`, () => {
    testMachine(contract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () =>
        mount(() =>
          h(
            RindProvider,
            { environment: { platform: currentRun()?.platform ?? platforms.linux } },
            () => [
              h(
                TagsInput.Root,
                {
                  ...rest,
                  ...(validate ? { validate } : {}),
                  // filter null: the listed suggestions stay the oracle's collection.
                  ...(suggestions ? { items: TOPICS, filter: null } : {}),
                } as P,
                () => parts(suggestions === true),
              ),
              h("button", { type: "button" }, "After"),
            ],
          ),
        ),
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

describe("Vue TagsInput matches React", () => {
  it("empty, tags in a form, read-only, disabled, max reached", async () => {
    for (const p of [
      {},
      { defaultValue: ["a", "b"], name: "tags", inputName: "draft" },
      { readOnly: true, defaultValue: ["a"] },
      { disabled: true, defaultValue: ["a"] },
      { max: 1, defaultValue: ["a"], required: true },
    ] as P[]) {
      const own = { id: "tags", ...p }
      const react = r("div", null, r(R.TagsInput.Root, own as never, ...reactParts(false)))
      const vue = () => h("div", [h(TagsInput.Root, own, () => parts(false))])
      await serverParity(react, vue)
      await clientParity(react, vue)
    }
  })
  it("suggestions, closed and filtered", async () => {
    for (const p of [{}, { defaultValue: ["rome"] }, { defaultInputValue: "o" }] as P[]) {
      const own = { id: "tags", items: TOPICS, ...p }
      const react = r("div", null, r(R.TagsInput.Root, own as never, ...reactParts(true)))
      const vue = () => h("div", [h(TagsInput.Root, own, () => parts(true))])
      await clientParity(react, vue)
    }
  })
})
