// The Prompt Input contract model (React's: props classes, request fixtures whose submit
// promise the "Settle request" button settles, the status walked through rerenders) against
// the Angular parts, and markup parity with React.
import { Component, input } from "@angular/core"
import {
  type PromptAttachment,
  type PromptInputProps,
  type PromptInputStatus,
  type PromptSubmitKey,
  platforms,
  promptInputContract,
  promptInputMessages,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { afterAll, beforeAll, describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { PromptInput } from "./index"

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

interface Root {
  readonly defaultAttachments?: readonly PromptAttachment[]
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly defaultValue?: string
  readonly submitKey?: PromptSubmitKey
  readonly history?: readonly string[]
  readonly status?: PromptInputStatus
}
interface Config {
  readonly root?: Root
  readonly kind?: "plain" | "requests"
  readonly count?: number
  readonly coarse?: boolean
  readonly rerender?: boolean
}

/** The configuration the next model fixture renders, its submit and its settle. */
let model: { cfg: Config; submit: (m: { text: string }) => unknown; settle: () => void } = {
  cfg: {},
  submit: () => undefined,
  settle: () => {},
}

@Component({
  selector: "rind-f",
  imports: [RindProvider, PromptInput],
  template: `<ng-container rindProvider [environment]="env">
    <form
      rindPromptInputRoot
      [submitHandler]="submit"
      (stop)="(0)"
      [defaultAttachments]="root.defaultAttachments"
      [readonly]="root.readOnly ?? false"
      [disabled]="root.disabled ?? false"
      [defaultValue]="root.defaultValue ?? ''"
      [submitKey]="root.submitKey ?? 'enter'"
      [history]="root.history"
      [status]="status() ?? root.status"
    >
      <label rindPromptInputLabel>Message</label>
      <div rindPromptInputAttachments></div>
      <textarea rindPromptInputTextarea></textarea>
      @if (cfg.count !== undefined) {
        <span rindPromptInputCharacterCount [max]="cfg.count"></span>
      }
      <button rindPromptInputAttachTrigger></button>
      <button rindPromptInputSubmit></button>
    </form>
    <!-- Settles nothing in the plain classes: their sends settle at once. A press keeps focus. -->
    <button type="button" tabindex="-1" (mousedown)="$event.preventDefault()" (click)="settle()">
      Settle request
    </button>
    <button type="button">After</button>
  </ng-container>`,
})
class Model {
  readonly status = input<PromptInputStatus>()
  readonly cfg = model.cfg
  readonly root: Root = model.cfg.root ?? {}
  readonly submit = model.submit
  readonly settle = model.settle
  readonly env = {
    platform: currentRun()?.platform ?? platforms.linux,
    ...(model.cfg.coarse ? { coarsePointer: true } : {}),
  }
}

function config(name: string, cfg: Config) {
  const fixture = {
    calls: 0,
    pending: [] as { resolve(): void; reject(e: unknown): void; text: string }[],
  }
  const requests = cfg.kind === "requests"
  const submit = (m: { text: string }) => {
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
  // The contract's keyboard twin of the button.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "F6") settle()
  }
  describe(`angular prompt-input model: ${name}`, () => {
    beforeAll(() => document.addEventListener("keydown", onKey))
    afterAll(() => document.removeEventListener("keydown", onKey))
    testMachine(promptInputContract, {
      test: (n: string, fn: () => Promise<void>) => it(n, fn, 20_000),
      setup: () => {
        fixture.calls = 0
        fixture.pending = []
        model = { cfg, submit, settle }
        return mount(Model, { status: cfg.root?.status })
      },
      ...(cfg.rerender
        ? {
            rerender: (
              next: { status?: PromptInputStatus },
              rendered: { rerender: (p: { status: PromptInputStatus }) => Promise<void> },
            ) => rendered.rerender({ status: next.status ?? "idle" }),
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

/** The configuration the next parity fixture renders. */
let current: { p: Root; count: number | undefined } = { p: {}, count: undefined }

@Component({
  selector: "rind-f",
  imports: [PromptInput],
  template: `<form
    rindPromptInputRoot
    id="ask"
    [defaultValue]="p.defaultValue ?? ''"
    [defaultAttachments]="p.defaultAttachments"
    [status]="p.status"
    [disabled]="p.disabled ?? false"
  >
    <label rindPromptInputLabel>Message</label>
    <div rindPromptInputAttachments></div>
    <textarea rindPromptInputTextarea placeholder="Ask"></textarea>
    @if (count !== undefined) {
      <span rindPromptInputCharacterCount [max]="count"></span>
    }
    <button rindPromptInputAttachTrigger></button>
    <button rindPromptInputSubmit></button>
  </form>`,
})
class Fixture {
  readonly p = current.p
  readonly count = current.count
}

const react = (p: Record<string, unknown>, count?: number) =>
  r(
    R.PromptInput.Root,
    { id: "ask", ...p },
    r(R.PromptInput.Label, null, "Message"),
    r(R.PromptInput.Attachments),
    r(R.PromptInput.Textarea, { placeholder: "Ask" }),
    count === undefined ? null : r(R.PromptInput.CharacterCount, { max: count }),
    r(R.PromptInput.AttachTrigger),
    r(R.PromptInput.Submit),
  )

describe("Angular PromptInput matches React", () => {
  const cases: [Root, number?][] = [
    [{}],
    [{ defaultValue: "hello", defaultAttachments: [{ id: "a", name: "a.png" }] }],
    [{ status: "streaming" }],
    [{ disabled: true }],
    [{ defaultValue: "four" }, 3],
  ]
  for (const [p, count] of cases) {
    it(`empty, a draft with attachments, streaming, disabled, a count ${JSON.stringify(p)}`, async () => {
      current = { p, count }
      await both(react(p as Record<string, unknown>, count), Fixture)
    })
  }
})
