// Model-based tests (add-streaming-message 5.2): the parent drives `status` and `text` ($props
// steps) on a virtual clock (the reveal's ticks), every announce mode; the invariants (busy,
// data-busy and caret agree; the body is never live) and axe after every step.
import {
  type StreamingAnnounce,
  streamingMessageContract,
  streamingMessageMessages,
} from "@rind-ui/core"
import { RindProvider, StreamingMessage, type StreamingMessageRootProps } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, testMachine, virtualClock } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Props = Pick<StreamingMessageRootProps, "text" | "status" | "announce">

function variant(announce: StreamingAnnounce) {
  const clock = virtualClock()
  const ui = (p: Props) => (
    <RindProvider environment={{ scheduler: clock.scheduler, reducedMotion: false }}>
      <StreamingMessage.Root role="article" aria-label="Assistant" {...p}>
        <StreamingMessage.Content />
        <StreamingMessage.Caret />
      </StreamingMessage.Root>
    </RindProvider>
  )
  const base = { text: "", status: "pending" as const, announce, smooth: true }
  describe(`streaming-message model: announce ${announce}`, () => {
    testMachine(streamingMessageContract, {
      // Three announced outcomes in one path (pending → cancelled → complete → error) take
      // about a second each in the DOM announcer.
      test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
      setup: () => render(ui(base)),
      rerender: (next: unknown, rendered: ReturnType<typeof render>) => {
        const p = next as unknown as Props
        rendered.rerender(ui({ text: p.text, status: p.status, announce }))
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
