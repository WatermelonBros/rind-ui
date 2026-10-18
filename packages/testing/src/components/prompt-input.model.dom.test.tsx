// Model-based tests: the Prompt Input contract over props classes, with the request status
// walked through rerenders ($props:status). The oracle runs the real machine.
import {
  type PromptInputProps,
  type PromptInputStatus,
  platforms,
  promptInputContract,
  promptInputMessages,
} from "@rind-ui/core"
import { PromptInput, type PromptInputRootProps, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

// Every prop the machine's guards read, as the component passes it.
const base: Partial<PromptInputProps> = {
  id: "p",
  locale: "en-US",
  messages: promptInputMessages,
  disabled: false,
  readOnly: false,
  history: undefined,
  accept: undefined,
  maxFiles: undefined,
  maxFileSize: undefined,
  limit: undefined,
  count: undefined,
  threshold: undefined,
  onSubmit: undefined,
  status: undefined,
}

function ui(props: Partial<PromptInputRootProps>) {
  return (
    <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
      <PromptInput.Root onSubmit={() => {}} {...props}>
        <PromptInput.Label>Message</PromptInput.Label>
        <PromptInput.Attachments />
        <PromptInput.Textarea />
        <PromptInput.AttachTrigger />
        <PromptInput.Submit />
      </PromptInput.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

function config(name: string, props: Partial<PromptInputRootProps>, rerender = false) {
  describe(`prompt-input model: ${name}`, () => {
    testMachine(promptInputContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => render(ui(props)),
      ...(rerender
        ? {
            rerender: (next: { status?: PromptInputStatus }, rendered: ReturnType<typeof render>) =>
              rendered.rerender(ui({ ...props, status: next.status ?? "idle" })),
          }
        : {}),
      target: () => screen,
      anchor: [{ name: "Message" }],
      props: { ...base, ...props } as never,
      a11y,
      modalities: rerender ? ["keyboard", "pointer"] : ["pointer", "keyboard", "virtual"],
    } as never)
  })
}

config("default", {})
config("with attachments", { defaultAttachments: [{ id: "a", name: "a.png" }] })
config("status driven", { status: "idle" }, true)
config("read-only", { readOnly: true })
