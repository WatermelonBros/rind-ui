/** @jsxImportSource solid-js */
// The Streaming Message contract model (React's: the parent drives `status` and `text` on a
// virtual clock, every announce mode) against the Solid parts, and markup parity with React.
import {
  type StreamingAnnounce,
  streamingMessageContract,
  streamingMessageMessages,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, StreamingMessage, type StreamingMessageRootProps } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

interface Props {
  readonly text: string
  readonly status: "pending" | "streaming" | "complete" | "cancelled" | "error"
}

function variant(announce: StreamingAnnounce) {
  const clock = virtualClock()
  const ui = (p: Props): JSX.Element => (
    <RindProvider environment={{ scheduler: clock.scheduler, reducedMotion: false }}>
      <StreamingMessage.Root
        role="article"
        aria-label="Assistant"
        announce={announce}
        text={p.text}
        status={p.status}
      >
        <StreamingMessage.Content />
        <StreamingMessage.Caret />
      </StreamingMessage.Root>
    </RindProvider>
  )
  const base = { text: "", status: "pending" as const, announce, smooth: true }
  describe(`solid streaming-message model: announce ${announce}`, () => {
    testMachine(streamingMessageContract, {
      // Three announced outcomes in one path take about a second each in the DOM announcer.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => mount(ui, { text: base.text, status: base.status }),
      rerender: (next: unknown, rendered: { rerender: (p: Props) => void }) => {
        const p = next as Props
        rendered.rerender({ text: p.text, status: p.status })
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

const solid = (p: Record<string, unknown>) => (): JSX.Element => (
  <StreamingMessage.Root
    id="reply"
    {...({ text: "Hello there.", ...p } as unknown as StreamingMessageRootProps)}
  >
    <StreamingMessage.Content />
    <StreamingMessage.Caret />
  </StreamingMessage.Root>
)
const react = (p: Record<string, unknown>) =>
  r(
    R.StreamingMessage.Root,
    { id: "reply", text: "Hello there.", ...p } as never,
    r(R.StreamingMessage.Content),
    r(R.StreamingMessage.Caret),
  )

describe("Solid StreamingMessage matches React", () => {
  it("pending, streaming, complete, failed", async () => {
    for (const p of [
      { status: "pending", text: "" },
      { status: "streaming" },
      { status: "complete" },
      { status: "error" },
    ]) {
      await clientParity(react(p), solid(p))
    }
  })
})
