// Streaming Message through its driver (spec streaming-message): the consumer's renderer,
// busy and caret, the server render, the reveal on a virtual clock, announcements, reduced
// motion, cancel.
import { RindProvider, StreamingMessage, type StreamingMessageRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { getStreamingMessage, recordingAnnouncer, virtualClock } from "../index"

function Message(props: Partial<StreamingMessageRootProps> & { readonly renderer?: boolean }) {
  const { renderer = false, ...root } = props
  return (
    <StreamingMessage.Root role="article" aria-label="Assistant" text="" status="pending" {...root}>
      <StreamingMessage.Content>
        {renderer
          ? (text: string) => <p data-testid="rendered">{text.toUpperCase()}</p>
          : undefined}
      </StreamingMessage.Content>
      <StreamingMessage.Caret />
    </StreamingMessage.Root>
  )
}

function setup(
  initial: Partial<StreamingMessageRootProps> & { readonly renderer?: boolean } = {},
  reducedMotion = false,
) {
  const rec = recordingAnnouncer()
  const clock = virtualClock()
  const tree = (p: Partial<StreamingMessageRootProps> & { readonly renderer?: boolean }) => (
    <RindProvider
      announcer={rec.announcer}
      environment={{ scheduler: clock.scheduler, reducedMotion }}
    >
      <Message {...p} />
    </RindProvider>
  )
  let current = initial
  const view = render(tree(current))
  const update = (next: Partial<StreamingMessageRootProps>) => {
    current = { ...current, ...next }
    view.rerender(tree(current))
  }
  const d = getStreamingMessage(screen, { name: "Assistant" })
  return { d, update, advance: (ms: number) => act(() => clock.advance(ms)), log: rec.log }
}

const said = (log: readonly { message: string }[]) => log.map((a) => a.message)

describe("streaming-message: rendering", () => {
  it("the consumer's renderer gets the displayed text", async () => {
    setup({ text: "hello", status: "complete", renderer: true })
    expect(screen.getByTestId("rendered").textContent).toBe("HELLO")
  })

  it("server HTML: the whole text, not busy, no caret", () => {
    const html = renderToString(
      <RindProvider>
        <Message text="Already here" status="complete" />
      </RindProvider>,
    )
    expect(html).toContain("Already here")
    expect(html).not.toContain("aria-busy")
    expect(html).not.toContain('data-part="caret"')
  })
})

describe("streaming-message: streaming", () => {
  it("busy with a caret while streaming; the reveal catches up on the clock; then complete", async () => {
    const { d, update, advance, log } = setup()
    update({ status: "streaming" })
    update({ text: "The answer is forty-two." })
    expect(await d.state()).toBe("streaming")
    expect(await d.isBusy()).toBe(true)
    expect(await d.hasCaret()).toBe(true)
    expect((await d.text()).length).toBeLessThan(24)
    update({ status: "complete" })
    expect(await d.state()).toBe("settling")
    await advance(1000)
    expect(await d.state()).toBe("complete")
    expect(await d.text()).toBe("The answer is forty-two.")
    expect(await d.isBusy()).toBe(false)
    expect(await d.hasCaret()).toBe(false)
    expect(said(log)).toEqual(["Generating a response", "Response complete"])
  })

  it("reduced motion: every chunk shows at once", async () => {
    const { d, update } = setup({}, true)
    update({ status: "streaming" })
    update({ text: "Straight away" })
    expect(await d.text()).toBe("Straight away")
  })

  it("cancel shows everything received and is announced", async () => {
    const { d, update, log } = setup()
    update({ status: "streaming" })
    update({ text: "Half of it" })
    update({ status: "cancelled" })
    expect(await d.text()).toBe("Half of it")
    expect(said(log).at(-1)).toBe("Response cancelled")
  })

  it("a reloaded, complete message is silent", async () => {
    const { log } = setup({ text: "Old", status: "complete" })
    expect(said(log)).toEqual([])
  })
})
