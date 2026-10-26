// Message Thread's rules in Node: follow and detach, unread, the user's turn in both layouts,
// jump and its focus, reduced motion.
import { describe, expect, it } from "vitest"
import { createService } from "../../machine/service"
import { type MessageThreadProps, messageThreadMachine } from "./message-thread.machine"

function make(over: Partial<MessageThreadProps> = {}) {
  const calls: string[] = []
  let props: MessageThreadProps = { count: 2, ...over }
  const env = {
    scrollToBottom: (b: string) => calls.push(`bottom:${b}`),
    revealTurn: (b: string) => calls.push(`turn:${b}`),
    focusLast: () => calls.push("focus"),
  }
  const s = createService(messageThreadMachine, props, env)
  s.start()
  const set = (next: Partial<MessageThreadProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  const state = () => s.getSnapshot().state
  const unread = () => s.getSnapshot().context.unread
  return { s, set, state, unread, calls }
}

describe("message-thread machine", () => {
  it("follows new messages; an upward scroll, a wheel or a selection detaches", () => {
    const m = make()
    m.set({ count: 3 })
    expect(m.calls).toEqual(["bottom:smooth"])
    m.s.send({ type: "SCROLLED", atBottom: false, up: true })
    expect(m.state()).toBe("detached")
    const w = make()
    w.s.send({ type: "ESCAPE" })
    expect(w.state()).toBe("detached")
  })

  it("detached: counts unread; back at the bottom re-attaches and clears", () => {
    const m = make()
    m.s.send({ type: "ESCAPE" })
    m.set({ count: 4 })
    expect(m.unread()).toBe(2)
    expect(m.calls).toEqual([])
    m.s.send({ type: "SCROLLED", atBottom: true, up: false })
    expect(m.state()).toBe("following")
    expect(m.unread()).toBe(0)
  })

  it("the user's own message re-attaches in the bottom layout", () => {
    const m = make()
    m.s.send({ type: "ESCAPE" })
    m.set({ count: 3, lastFromUser: true })
    expect(m.state()).toBe("following")
    expect(m.calls).toEqual(["bottom:smooth"])
  })

  it("after deletions while following, the user's next message still re-attaches", () => {
    const m = make({ count: 10 })
    m.set({ count: 8 })
    m.s.send({ type: "ESCAPE" })
    m.set({ count: 9, lastFromUser: true })
    expect(m.state()).toBe("following")
  })

  it("top layout: the user's turn goes to the top and growth is never followed", () => {
    const m = make({ anchor: "top" })
    m.set({ count: 3, lastFromUser: true })
    expect(m.calls).toEqual(["turn:smooth"])
    expect(m.state()).toBe("detached")
    m.set({ count: 4, lastFromUser: false })
    expect(m.calls).toEqual(["turn:smooth"])
    m.s.send({ type: "SCROLLED", atBottom: true, up: false })
    expect(m.state()).toBe("following")
  })

  it("jump: follow, clear, focus the last message only by keyboard or virtual", () => {
    const m = make()
    m.s.send({ type: "ESCAPE" })
    m.set({ count: 5 })
    m.s.send({ type: "JUMP", modality: "pointer" })
    expect(m.state()).toBe("following")
    expect(m.unread()).toBe(0)
    expect(m.calls).toEqual(["bottom:smooth"])
    m.s.send({ type: "ESCAPE" })
    m.s.send({ type: "JUMP", modality: "keyboard" })
    expect(m.calls.at(-1)).toBe("focus")
  })

  it("reduced motion scrolls instantly", () => {
    const m = make()
    m.s.send({ type: "MOTION.CHANGED", reduced: true })
    m.set({ count: 3 })
    expect(m.calls).toEqual(["bottom:instant"])
  })
})
