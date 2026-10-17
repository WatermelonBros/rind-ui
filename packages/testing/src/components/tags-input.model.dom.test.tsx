// Model-based tests: the Tags Input contract over props classes (task 5.3).
import { platforms, type TagsInputProps, tagsInputContract, tagsInputMessages } from "@rind-ui/core"
import { RindProvider, TagsInput, type TagsInputRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

type Config = Pick<
  TagsInputProps,
  "allowDuplicates" | "max" | "blurBehavior" | "editable" | "readOnly" | "defaultValue"
> & { readonly refuse?: boolean }

function config(name: string, cfg: Config) {
  const { refuse, ...rest } = cfg
  const validate = refuse ? () => "nope" : undefined
  describe(`tags-input model: ${name}`, () => {
    testMachine(tagsInputContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () =>
        render(
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            <TagsInput.Root {...(rest as TagsInputRootProps)} {...(validate ? { validate } : {})}>
              <TagsInput.Label>Tags</TagsInput.Label>
              <TagsInput.Control>
                <TagsInput.Chips />
                <TagsInput.Input />
                <TagsInput.ClearTrigger />
              </TagsInput.Control>
            </TagsInput.Root>
            <button type="button">After</button>
          </RindProvider>,
        ),
      target: () => screen,
      anchor: [{ name: "Tags" }],
      props: {
        locale: "en-US",
        messages: tagsInputMessages,
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
