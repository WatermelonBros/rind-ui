// Model-based tests: the Prompt Input contract over props classes, with request fixtures
// whose `onSubmit` promise the "Settle request" button settles (the rejecting one rejects a
// draft starting with "fail"), and the status walked through rerenders ($props:status).
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
import { afterAll, beforeAll, describe, it } from "vitest"
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
  status: undefined,
}

interface Fixture {
  /** onSubmit calls in the page (activation parity). */
  calls: number
  pending: { resolve(): void; reject(e: unknown): void; text: string }[]
}

type Kind = "plain" | "requests"

interface Config {
  readonly root?: Partial<PromptInputRootProps>
  readonly kind?: Kind
  readonly count?: number
  readonly coarse?: boolean
  readonly rerender?: boolean
}

function config(name: string, cfg: Config) {
  const fixture: Fixture = { calls: 0, pending: [] }
  const requests = cfg.kind === "requests"
  const onSubmit = (m: { text: string }) => {
    fixture.calls += 1
    if (!requests) return undefined
    return new Promise<void>((resolve, reject) => {
      fixture.pending.push({ resolve, reject, text: m.text })
    })
  }
  const settle = () => {
    for (const p of fixture.pending.splice(0)) {
      if (p.text.startsWith("fail")) p.reject(new Error("refused"))
      else p.resolve()
    }
  }
  const ui = (status?: PromptInputStatus) => (
    <RindProvider
      environment={{
        platform: currentRun()?.platform ?? platforms.linux,
        ...(cfg.coarse ? { coarsePointer: true } : {}),
      }}
    >
      <PromptInput.Root
        onSubmit={onSubmit}
        onStop={() => {}}
        {...cfg.root}
        {...(status ? { status } : {})}
      >
        <PromptInput.Label>Message</PromptInput.Label>
        <PromptInput.Attachments />
        <PromptInput.Textarea />
        {cfg.count === undefined ? null : <PromptInput.CharacterCount max={cfg.count} />}
        <PromptInput.AttachTrigger />
        <PromptInput.Submit />
      </PromptInput.Root>
      {/* Settles nothing in the plain classes: their sends settle at once. A press keeps focus. */}
      <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={settle}>
        Settle request
      </button>
      <button type="button">After</button>
    </RindProvider>
  )
  // The contract's keyboard twin of the button.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "F6") settle()
  }
  describe(`prompt-input model: ${name}`, () => {
    beforeAll(() => document.addEventListener("keydown", onKey))
    afterAll(() => document.removeEventListener("keydown", onKey))
    testMachine(promptInputContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => {
        fixture.calls = 0
        fixture.pending = []
        return render(ui(cfg.root?.status))
      },
      ...(cfg.rerender
        ? {
            rerender: (next: { status?: PromptInputStatus }, rendered: ReturnType<typeof render>) =>
              rendered.rerender(ui(next.status ?? "idle")),
          }
        : {}),
      activations: { action: "submit", count: () => fixture.calls },
      target: () => screen,
      anchor: [{ name: "Message" }],
      props: {
        ...base,
        // The oracle's own request never settles: the "Settle request" step moves it.
        onSubmit: requests ? () => new Promise(() => {}) : () => undefined,
        ...cfg.root,
        ...(cfg.count === undefined ? {} : { limit: cfg.count }),
      } as never,
      a11y,
      modalities: cfg.rerender ? ["keyboard", "pointer"] : ["pointer", "keyboard", "virtual"],
    } as never)
  })
}

config("default", {})
config("with attachments", { root: { defaultAttachments: [{ id: "a", name: "a.png" }] } })
config("read-only", { root: { readOnly: true } })
config("disabled", { root: { disabled: true, defaultValue: "x" } })
config("mod+enter", { root: { submitKey: "mod+enter" } })
config("touch-primary", { coarse: true })
config("character count", { count: 3 })
config("history", { root: { history: ["one", "two"] } })
config("resolving requests", { kind: "requests" })
config("rejecting requests", { kind: "requests", root: { defaultValue: "fail" } })
config("status driven", { root: { status: "idle" }, rerender: true })
