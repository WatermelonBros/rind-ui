import { describe, expect, it, vi } from "vitest"
import { platforms } from "../../dom/platform"
import type { Announcement, Scheduler } from "../../env"
import { createService } from "../../machine/service"
import { messageActionsConnect } from "./message-actions.connect"
import { messageActionsContract } from "./message-actions.contract"
import {
  type MessageActionsProps,
  messageActionsActive,
  messageActionsMachine,
  versionTarget,
} from "./message-actions.machine"
import { messageActionsMessages } from "./message-actions.messages"
import { messageActionsMeta } from "./message-actions.meta"

function make(over: Partial<MessageActionsProps> = {}) {
  const announced: Announcement[] = []
  const timers = new Map<number, () => void>()
  let seq = 1
  const scheduler: Scheduler = {
    setTimeout: (fn) => {
      timers.set(seq, fn)
      return seq++
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  }
  const restoreEditFocus = vi.fn()
  let props: MessageActionsProps = { id: "m", ...over }
  const env = {
    scheduler,
    restoreEditFocus,
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
  }
  const s = createService(messageActionsMachine, props, env)
  s.start()
  const flushTimers = () => {
    for (const [id, fn] of [...timers]) {
      timers.delete(id)
      fn()
    }
  }
  return {
    s,
    announced,
    restoreEditFocus,
    flushTimers,
    view: () => s.view(props),
    set: (p: Partial<MessageActionsProps>) => {
      props = { ...props, ...p }
      s.setProps(props)
    },
  }
}

/** Lets the regenerate promise's handlers run (microtasks only, no elapsed time). */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe("message actions machine", () => {
  it("regenerate: pending until the promise settles; a second press is ignored", async () => {
    let resolve = () => {}
    const onRegenerate = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const t = make({ onRegenerate })
    t.s.send({ type: "PRESS.REGENERATE" })
    t.s.send({ type: "PRESS.REGENERATE" })
    expect(onRegenerate).toHaveBeenCalledTimes(1)
    expect(t.view().context.regenerate).toBe("pending")
    resolve()
    await flush()
    expect(t.view().context.regenerate).toBe("done")
    t.flushTimers()
    expect(t.view().context.regenerate).toBe("idle")
  })

  it("regenerate: a rejection is error", async () => {
    const t = make({ onRegenerate: () => Promise.reject(new Error("x")) })
    t.s.send({ type: "PRESS.REGENERATE" })
    await flush()
    expect(t.view().context.regenerate).toBe("error")
  })

  it("edit toggles and restores focus when editing ends (assistant-ui#8208)", () => {
    const t = make()
    t.s.send({ type: "PRESS.EDIT" })
    expect(t.view().values.editing).toBe(true)
    t.s.send({ type: "PRESS.EDIT" })
    expect(t.view().values.editing).toBe(false)
    expect(t.restoreEditFocus).toHaveBeenCalledTimes(1)
  })

  it("versions: no wrap by default, announced on each move", () => {
    const t = make({ count: 3 })
    t.s.send({ type: "PRESS.PREVIOUS" })
    expect(t.announced).toHaveLength(0)
    t.s.send({ type: "PRESS.NEXT" })
    t.s.send({ type: "PRESS.NEXT" })
    t.s.send({ type: "PRESS.NEXT" })
    expect(t.view().values.index).toBe(2)
    expect(t.announced.map((a) => a.message)).toEqual(["Version 2 of 3", "Version 3 of 3"])
  })

  it("versions wrap with loop", () => {
    expect(versionTarget(2, 3, 1, true)).toBe(0)
    expect(versionTarget(0, 3, -1, true)).toBe(2)
    expect(versionTarget(0, 1, 1, true)).toBeNull()
  })

  it("visible while hovered, focused within, touched or forced", () => {
    const t = make()
    expect(messageActionsActive(t.view().context, {})).toBe(false)
    t.s.send({ type: "FOCUS.IN" })
    t.s.send({ type: "POINTER.LEAVE" })
    expect(messageActionsActive(t.view().context, {})).toBe(true)
    t.s.send({ type: "FOCUS.OUT" })
    expect(messageActionsActive(t.view().context, { active: true })).toBe(true)
  })
})

const env = { platform: platforms.linux } as unknown as Parameters<typeof messageActionsConnect>[1] // only platform is read
const api = (over: Partial<Parameters<typeof messageActionsConnect>[0]> = {}) =>
  messageActionsConnect(
    {
      instance: "m",
      active: true,
      editing: false,
      regenerate: "pending",
      count: 3,
      index: 2,
      loop: false,
      messages: messageActionsMessages,
      named: false,
      ...over,
    },
    env,
  )
const b = { tag: "button", focused: true, modality: "keyboard" as const }
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("message actions connect", () => {
  it("names every button; pending regenerate is disabled and busy, still focusable", () => {
    const r = api().regenerate(b)
    expect(r).toMatchObject({
      "aria-label": "Regenerate",
      "aria-busy": "true",
      "aria-disabled": "true",
    })
    expect(r["disabled"]).toBeUndefined()
    expect(api().edit(b)).toMatchObject({ "aria-label": "Edit", "aria-pressed": "false" })
  })

  it("the last version disables Next, focusable", () => {
    const a = api()
    expect(a.versionNext(b)["aria-disabled"]).toBe("true")
    expect(a.versionPrevious(b)["aria-disabled"]).toBeUndefined()
    expect(a.versionText).toBe("3 / 3")
    expect(api({ count: 1 }).hasVersions).toBe(false)
  })

  it("meta matches the code", () => {
    const a = api({ editing: true })
    const parts = {
      root: a.root(),
      regenerate: a.regenerate(b),
      edit: a.edit(b),
      versions: a.versions(),
      "version-previous": api({ index: 0 }).versionPrevious(b),
      "version-next": a.versionNext(b),
      "version-status": a.versionStatus(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        messageActionsMeta.dataAttributes[part as keyof typeof messageActionsMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(messageActionsMeta.contract.queries).toEqual(Object.keys(messageActionsContract.queries))
    expect(Object.keys(messageActionsMeta.states)).toEqual(
      Object.keys(messageActionsMachine.def.states),
    )
  })
})
