// The Streaming Message contract model (React's: the parent drives `status` and `text` on a
// virtual clock, every announce mode) against the Angular parts, and markup parity with React.
import { Component, input } from "@angular/core"
import {
  type StreamingAnnounce,
  type StreamingStatus,
  streamingMessageContract,
  streamingMessageMessages,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { StreamingMessage } from "./index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

interface Props {
  readonly text: string
  readonly status: StreamingStatus
}

/** The model fixture's clock and announce mode. */
let model: { clock: ReturnType<typeof virtualClock>; announce: StreamingAnnounce } = {
  clock: virtualClock(),
  announce: "status",
}

@Component({
  selector: "rind-f",
  imports: [RindProvider, StreamingMessage],
  template: `<ng-container rindProvider [environment]="env">
    <div
      rindStreamingMessageRoot
      role="article"
      aria-label="Assistant"
      [text]="text()"
      [status]="status()"
      [announce]="announce"
    >
      <div rindStreamingMessageContent></div>
      <span rindStreamingMessageCaret></span>
    </div>
  </ng-container>`,
})
class Model {
  readonly text = input("")
  readonly status = input<StreamingStatus>("pending")
  readonly announce = model.announce
  readonly env = { scheduler: model.clock.scheduler, reducedMotion: false }
}

function variant(announce: StreamingAnnounce) {
  const clock = virtualClock()
  const base = { text: "", status: "pending" as const, announce, smooth: true }
  describe(`angular streaming-message model: announce ${announce}`, () => {
    testMachine(streamingMessageContract, {
      test: it,
      setup: () => {
        model = { clock, announce }
        return mount(Model, { text: base.text, status: base.status })
      },
      rerender: (next: unknown, rendered: { rerender: (p: Props) => Promise<void> }) => {
        const p = next as Props
        return rendered.rerender({ text: p.text, status: p.status })
      },
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms) }),
      anchor: [{ name: "Assistant" }],
      props: { ...base, id: "oracle", messages: streamingMessageMessages } as never,
      modalities: ["pointer"],
      clock,
      a11y,
    } as never)
  })
}
variant("status")
variant("text")

/** The configuration the next fixture renders. */
let current: { status: StreamingStatus; text?: string } = { status: "pending" }

@Component({
  selector: "rind-f",
  imports: [StreamingMessage],
  template: `<div rindStreamingMessageRoot id="reply" [text]="p.text ?? 'Hello there.'" [status]="p.status">
    <div rindStreamingMessageContent></div>
    <span rindStreamingMessageCaret></span>
  </div>`,
})
class Fixture {
  readonly p = current
}

const react = (p: Record<string, unknown>) =>
  r(
    R.StreamingMessage.Root,
    { id: "reply", text: "Hello there.", ...p } as never,
    r(R.StreamingMessage.Content),
    r(R.StreamingMessage.Caret),
  )

describe("Angular StreamingMessage matches React", () => {
  for (const p of [
    { status: "pending", text: "" },
    { status: "streaming" },
    { status: "complete" },
    { status: "error" },
  ] as (typeof current)[]) {
    it(`pending, streaming, complete, failed ${JSON.stringify(p)}`, async () => {
      current = p
      await both(react(p), Fixture)
    })
  }
})
