// Message Thread through its driver (spec message-thread): the feed, follow and detach,
// unread and jump, the user's turn in both layouts, Page Down / Up, Control+End, prepend,
// reduced motion. Scrolling needs layout: those run in the browser.
import { MessageThread, type MessageThreadRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { getMessageThread } from "../index"

const browser = !navigator.userAgent.includes("jsdom")

type Msg = { readonly id: number; readonly from: "user" | "assistant"; readonly lines: number }
const conversation = (n: number, first = 0): Msg[] =>
  Array.from({ length: n }, (_, i) => ({
    id: first + i,
    from: (first + i) % 2 === 0 ? "user" : "assistant",
    lines: 3,
  }))

function Thread({
  list,
  ...props
}: { readonly list: readonly Msg[] } & Partial<MessageThreadRootProps>) {
  return (
    <MessageThread.Root
      count={list.length}
      lastFromUser={list.at(-1)?.from === "user"}
      {...props}
      style={{ position: "relative" }}
    >
      <MessageThread.Viewport style={{ height: 200 }}>
        {list.map((m, i) => (
          <MessageThread.Message key={m.id} index={i} from={m.from}>
            {Array.from({ length: m.lines }, (_, l) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static lines.
              <p key={l} style={{ margin: 0, height: 20 }}>
                message {m.id} line {l}
              </p>
            ))}
          </MessageThread.Message>
        ))}
      </MessageThread.Viewport>
      <MessageThread.JumpToLatest />
    </MessageThread.Root>
  )
}

function setup(list: readonly Msg[], props: Partial<MessageThreadRootProps> = {}) {
  const tree = (l: readonly Msg[], p: Partial<MessageThreadRootProps>) => (
    <RindProvider environment={{ reducedMotion: true }}>
      <Thread list={l} {...p} />
      <textarea aria-label="Prompt" />
    </RindProvider>
  )
  const view = render(tree(list, props))
  return {
    d: getMessageThread(screen, { name: "Conversation" }),
    update: (l: readonly Msg[], p: Partial<MessageThreadRootProps> = props) =>
      view.rerender(tree(l, p)),
  }
}

const viewport = () => screen.getByRole("feed")
const frames = () =>
  act(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))

describe("message-thread: feed", () => {
  it("a named feed of articles named by speaker, with positions; never live", () => {
    setup(conversation(3))
    expect(viewport().getAttribute("aria-live")).toBeNull()
    const items = screen.getAllByRole("article")
    expect(items.map((a) => a.getAttribute("aria-label"))).toEqual(["You", "Assistant", "You"])
    expect(items.map((a) => a.getAttribute("aria-posinset"))).toEqual(["1", "2", "3"])
    expect(items[0]?.getAttribute("aria-setsize")).toBe("3")
  })

  it("Page Down / Up move between articles; Control+End leaves to the prompt", async () => {
    setup(conversation(4))
    const items = screen.getAllByRole("article")
    items[0]?.focus()
    await userEvent.keyboard("{PageDown}{PageDown}")
    expect(document.activeElement).toBe(items[2])
    await userEvent.keyboard("{PageUp}")
    expect(document.activeElement).toBe(items[1])
    await userEvent.keyboard("{Control>}{End}{/Control}")
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Prompt" }))
  })

  it("aria-busy while older messages load", () => {
    setup(conversation(2), { loadingOlder: true })
    expect(viewport().getAttribute("aria-busy")).toBe("true")
  })
})

describe.runIf(browser)("message-thread: scrolling", () => {
  it("opens at the bottom, following; new messages are followed", async () => {
    const { d, update } = setup(conversation(10))
    await frames()
    expect(await d.state()).toBe("following")
    expect(await d.isAtBottom()).toBe(true)
    update(conversation(12))
    await frames()
    expect(await d.isAtBottom()).toBe(true)
  })

  it("reading back detaches; new messages are counted; jump returns and focuses by keyboard", async () => {
    const { d, update } = setup(conversation(10))
    await frames()
    await d.scrollUp()
    await frames()
    expect(await d.state()).toBe("detached")
    update([
      ...conversation(10),
      { id: 10, from: "assistant", lines: 3 },
      { id: 11, from: "assistant", lines: 3 },
    ])
    await frames()
    expect(await d.isAtBottom()).toBe(false)
    expect(screen.getByRole("button", { name: "2 new messages, jump to latest" })).toBeTruthy()
    await getMessageThread(screen, { name: "Conversation" }, { modality: "keyboard" }).jump()
    await frames()
    expect(await d.state()).toBe("following")
    expect(await d.isAtBottom()).toBe(true)
    expect(document.activeElement).toBe(screen.getAllByRole("article").at(-1))
  })

  it("the user's own message re-attaches", async () => {
    const { d, update } = setup(conversation(9))
    await frames()
    await d.scrollUp()
    await frames()
    update(conversation(11))
    await frames()
    expect(await d.state()).toBe("following")
    expect(await d.isAtBottom()).toBe(true)
  })

  it("top layout: the user's turn scrolls to the top of the viewport", async () => {
    const { update } = setup(conversation(10), { anchor: "top" })
    await frames()
    update(conversation(11), { anchor: "top" })
    await frames()
    const last = screen.getAllByRole("article").at(-1) as HTMLElement
    expect(
      Math.abs(last.getBoundingClientRect().top - viewport().getBoundingClientRect().top),
    ).toBeLessThan(2)
  })

  it("a prepend keeps the reading position", async () => {
    const { update } = setup(conversation(10, 10))
    await frames()
    viewport().scrollTop = 0
    await frames()
    const first = screen.getAllByRole("article")[0] as HTMLElement
    const before = first.getBoundingClientRect().top
    update([...conversation(10, 0), ...conversation(10, 10)])
    await frames()
    expect(Math.abs(first.getBoundingClientRect().top - before)).toBeLessThan(1)
  })
})
