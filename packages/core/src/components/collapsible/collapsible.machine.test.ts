// The Collapsible machine in Node: every transition, the disabled guard, controlled
// proposals and the `reveal` context.
import { describe, expect, it, vi } from "vitest"
import { createService } from "../../machine/service"
import {
  type CollapsibleEvent,
  type CollapsibleProps,
  collapsibleMachine,
} from "./collapsible.machine"

function make(over: Partial<CollapsibleProps> = {}) {
  const onOpenChange = vi.fn()
  const focusOutOfContent = vi.fn()
  let props: CollapsibleProps = { onOpenChange, focusOutOfContent, ...over }
  const s = createService(collapsibleMachine, props as never, {} as never)
  s.start()
  return {
    s,
    onOpenChange,
    focusOutOfContent,
    state: () => s.getSnapshot().state,
    open: () => (s.view().values as Record<string, unknown>)["open"],
    reveal: () => (s.getSnapshot().context as { reveal: unknown }).reveal,
    send: (e: CollapsibleEvent) => s.send(e as never),
    setProps: (p: Partial<CollapsibleProps>) => {
      props = { ...props, ...p }
      s.setProps(props as never)
    },
  }
}
const toggle = { type: "TOGGLE", modality: "pointer" } as const
const openApi = { type: "OPEN", reason: "api" } as const
const openFind = { type: "OPEN", reason: "find-in-page" } as const
const closeApi = { type: "CLOSE", reason: "api" } as const

describe("transitions", () => {
  it("TOGGLE closed -> open -> closed, reporting each with the TOGGLE event", () => {
    const m = make()
    expect(m.state()).toBe("closed")
    m.send(toggle)
    expect(m.state()).toBe("open")
    expect(m.open()).toBe(true)
    m.send(toggle)
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
    expect(m.onOpenChange.mock.calls.map((c) => c[0])).toEqual([true, false])
    expect(m.onOpenChange.mock.calls[0]?.[1].event).toMatchObject({ type: "TOGGLE" })
  })

  it("OPEN api and find-in-page open from closed", () => {
    const a = make()
    a.send(openApi)
    expect(a.state()).toBe("open")
    const b = make()
    b.send(openFind)
    expect(b.state()).toBe("open")
    expect(b.onOpenChange.mock.calls[0]?.[1].event).toMatchObject({
      type: "OPEN",
      reason: "find-in-page",
    })
  })

  it("OPEN when already open is ignored: reveal never toggles", () => {
    const m = make({ defaultOpen: true })
    m.send(openFind)
    m.send(openApi)
    expect(m.state()).toBe("open")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("CLOSE api closes", () => {
    const m = make({ defaultOpen: true })
    m.send(closeApi)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange.mock.calls[0]?.[1].event).toMatchObject({ type: "CLOSE" })
  })

  it("CLOSE while closed is ignored", () => {
    const m = make()
    m.send(closeApi)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })
})

describe("disabled", () => {
  it("ignores TOGGLE and OPEN find-in-page, allows OPEN api and CLOSE", () => {
    const m = make({ disabled: true })
    m.send(toggle)
    m.send(openFind)
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
    m.send(openApi)
    expect(m.state()).toBe("open")
    m.send(toggle)
    expect(m.state()).toBe("open")
    m.send(closeApi)
    expect(m.state()).toBe("closed")
  })

  it("takes effect on the next interaction", () => {
    const m = make()
    m.setProps({ disabled: true })
    m.send(toggle)
    expect(m.state()).toBe("closed")
    m.setProps({ disabled: false })
    m.send(toggle)
    expect(m.state()).toBe("open")
  })
})

describe("controlled open", () => {
  it("a press is a proposal: onOpenChange gets the event, a refusal leaves the state", () => {
    const m = make({ open: false })
    m.send(toggle)
    expect(m.onOpenChange).toHaveBeenCalledTimes(1)
    expect(m.onOpenChange.mock.calls[0]?.[0]).toBe(true)
    expect(m.onOpenChange.mock.calls[0]?.[1].event).toMatchObject({ type: "TOGGLE" })
    expect(m.state()).toBe("closed")
    expect(m.open()).toBe(false)
  })

  it("a parent-driven change moves the state without calling onOpenChange", () => {
    const m = make({ open: false })
    m.setProps({ open: true })
    expect(m.state()).toBe("open")
    m.setProps({ open: false })
    expect(m.state()).toBe("closed")
    expect(m.onOpenChange).not.toHaveBeenCalled()
  })

  it("accepting the proposal opens it", () => {
    const m = make({ open: false })
    m.send(toggle)
    m.setProps({ open: true })
    expect(m.state()).toBe("open")
  })
})

describe("context reveal", () => {
  it('is "mount" when defaultOpen or open, null otherwise', () => {
    expect(make({ defaultOpen: true }).reveal()).toBe("mount")
    expect(make({ open: true }).reveal()).toBe("mount")
    expect(make().reveal()).toBeNull()
  })

  it('is "find-in-page" after OPEN find-in-page and cleared on the next transition', () => {
    const m = make()
    m.send(openFind)
    expect(m.reveal()).toBe("find-in-page")
    m.send(toggle)
    expect(m.reveal()).toBeNull()
  })

  it("mount is cleared by the first transition", () => {
    const m = make({ defaultOpen: true })
    m.send(toggle)
    expect(m.reveal()).toBeNull()
    m.send(toggle)
    expect(m.reveal()).toBeNull()
  })

  it("OPEN api leaves it null", () => {
    const m = make()
    m.send(openApi)
    expect(m.reveal()).toBeNull()
  })
})

describe("focus", () => {
  it("leaving open calls props.focusOutOfContent, entering does not", () => {
    const m = make()
    m.send(toggle)
    expect(m.focusOutOfContent).not.toHaveBeenCalled()
    m.send(toggle)
    expect(m.focusOutOfContent).toHaveBeenCalledTimes(1)
    m.send(openApi)
    m.send(closeApi)
    expect(m.focusOutOfContent).toHaveBeenCalledTimes(2)
  })
})
