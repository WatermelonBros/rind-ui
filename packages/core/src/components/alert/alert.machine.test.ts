// The Alert machine with a recording announcer (add-alert 1.2): one message per client mount,
// per `$sync:open → open` and per text change while open; none while hydrating, with
// announce="off", while closed or on dismissal (chakra-ui#3240, mui/material-ui#40198,
// #49440, ariakit#7235).
import { describe, expect, it } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type AlertProps, alertMachine } from "./alert.machine"
import { alertMessages } from "./alert.messages"

function make(over: Partial<AlertProps> = {}) {
  const log: Announcement[] = []
  const calls: [boolean, string][] = []
  const order: string[] = []
  let prepared = 0
  let props: AlertProps = {
    messages: alertMessages,
    id: "a1",
    onOpenChange: (open, d) => {
      order.push("change")
      calls.push([open, d.reason])
    },
    moveFocusOut: () => order.push("focus"),
    ...over,
  }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        log.push(a)
      },
      prepare: () => {
        prepared += 1
        return () => {}
      },
      cancel: () => {},
    },
  }
  const s = createService(alertMachine, props, env)
  s.start()
  const set = (p: Partial<AlertProps>) => {
    props = { ...props, ...p }
    s.setProps(props)
  }
  const mount = (segments: readonly string[], hydrating = false) =>
    s.send({ type: "ROOT.MOUNT", hydrating, segments })
  return { s, log, calls, order, set, mount, prepared: () => prepared }
}

describe("alert machine: announcements", () => {
  it("a client mount announces once, politely by default (Polite by default)", () => {
    const { log, mount } = make()
    mount(["Connection lost"])
    expect(log).toEqual([{ message: "Connection lost.", priority: "polite", key: "alert-a1" }])
  })

  it("a hydrating mount is silent (mui/material-ui#49440)", () => {
    const { log, mount } = make({ announce: "assertive" })
    mount(["Couldn't save"], true)
    expect(log).toEqual([])
  })

  it("assertive is passed through (chakra-ui#3240)", () => {
    const { log, mount } = make({ announce: "assertive" })
    mount(["Couldn't save", "Disk full"])
    expect(log).toEqual([
      { message: "Couldn't save. Disk full.", priority: "assertive", key: "alert-a1" },
    ])
  })

  it("polite stays polite (mui/material-ui#40198)", () => {
    const { log, mount } = make({ announce: "polite" })
    mount(["Message sent"])
    expect(log.map((a) => a.priority)).toEqual(["polite"])
  })

  it("off never announces and never prepares", () => {
    const { log, mount, s, set, prepared } = make({ announce: "off" })
    mount(["This project is archived"])
    s.send({ type: "CONTENT.CHANGE", segments: ["Other"] })
    set({ open: false })
    set({ open: true })
    expect(log).toEqual([])
    expect(prepared()).toBe(0)
  })

  it("prepares the announcer on start when live", () => {
    expect(make().prepared()).toBe(1)
  })

  it("Strict Mode's second mount does not announce again", () => {
    const { log, mount, s } = make()
    mount(["Saved"])
    s.stop()
    s.start()
    mount(["Saved"])
    expect(log).toHaveLength(1)
  })

  it("a re-render without a text change does not announce (ariakit#7235)", () => {
    const { log, mount, s } = make()
    mount(["Saved"])
    s.send({ type: "CONTENT.CHANGE", segments: ["Saved"] })
    expect(log).toHaveLength(1)
  })

  it("a text change while open announces; back to an earlier text announces too", () => {
    const { log, mount, s } = make()
    mount(["Reconnecting…"])
    s.send({ type: "CONTENT.CHANGE", segments: ["Connected"] })
    s.send({ type: "CONTENT.CHANGE", segments: ["Reconnecting…"] })
    expect(log.map((a) => a.message)).toEqual(["Reconnecting…", "Connected.", "Reconnecting…"])
  })

  it("changes while closed are silent; shown again through open announces once", () => {
    const { log, mount, s, set } = make({ open: true })
    mount(["Saved"])
    set({ open: false })
    s.send({ type: "CONTENT.CHANGE", segments: ["Saved again"] })
    expect(log).toHaveLength(1)
    set({ open: true })
    expect(log.map((a) => a.message)).toEqual(["Saved.", "Saved again."])
  })

  it("mounted closed then opened announces once", () => {
    const { log, mount, set } = make({ open: false })
    mount(["Saved"])
    expect(log).toEqual([])
    set({ open: true })
    expect(log).toHaveLength(1)
  })

  it("the consumer announcement wins; an empty message is not announced", () => {
    const a = make({ announcement: "3 errors in the form. Fix them and submit again." })
    a.mount(["3 errors"])
    expect(a.log.map((x) => x.message)).toEqual([
      "3 errors in the form. Fix them and submit again.",
    ])
    const b = make()
    b.mount([])
    expect(b.log).toEqual([])
  })

  it("carries the alert's locale", () => {
    const { log, mount } = make({ lang: "it-IT" })
    mount(["Salvato"])
    expect(log[0]?.lang).toBe("it-IT")
  })
})

describe("alert machine: dismissal", () => {
  it("CLOSE moves focus before onOpenChange, reason close-trigger, nothing announced", () => {
    const { log, mount, s, calls, order } = make()
    mount(["Saved"])
    s.send({ type: "CLOSE", focusInside: true })
    expect(order).toEqual(["focus", "change"])
    expect(calls).toEqual([[false, "close-trigger"]])
    expect(s.getSnapshot().state).toBe("closed")
    expect(log).toHaveLength(1)
  })

  it("focus outside the alert does not move", () => {
    const { mount, s, order } = make()
    mount(["Saved"])
    s.send({ type: "CLOSE", focusInside: false })
    expect(order).toEqual(["change"])
  })

  it("controlled: the close is proposed and waits for the parent", () => {
    const { mount, s, set, calls } = make({ open: true })
    mount(["Saved"])
    s.send({ type: "CLOSE", focusInside: false })
    expect(calls).toEqual([[false, "close-trigger"]])
    expect(s.getSnapshot().state).toBe("open")
    set({ open: false })
    expect(s.getSnapshot().state).toBe("closed")
  })
})
