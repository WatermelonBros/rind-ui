// Model-based tests: the Tags Input contract over props classes (task 5.3; suggestions:
// tags-input-suggestions 2.3).
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
import { RindProvider, TagsInput, type TagsInputRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

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
  describe(`tags-input model: ${name}`, () => {
    testMachine(contract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () =>
        render(
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            <TagsInput.Root
              {...(rest as TagsInputRootProps)}
              {...(validate ? { validate } : {})}
              // filter null: the listed suggestions stay the oracle's collection.
              {...(suggestions ? { items: TOPICS, filter: null } : {})}
            >
              <TagsInput.Label>Tags</TagsInput.Label>
              <TagsInput.Control>
                <TagsInput.Chips />
                <TagsInput.Input />
                <TagsInput.ClearTrigger />
              </TagsInput.Control>
              {suggestions ? (
                <TagsInput.Positioner>
                  <TagsInput.Popup>
                    <TagsInput.List>
                      <TagsInput.Items />
                    </TagsInput.List>
                  </TagsInput.Popup>
                </TagsInput.Positioner>
              ) : null}
            </TagsInput.Root>
            <button type="button">After</button>
          </RindProvider>,
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
