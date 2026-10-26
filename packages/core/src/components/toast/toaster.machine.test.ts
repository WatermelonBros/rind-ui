import { describe, expect, it } from "vitest"
import { createService } from "../../machine/service"
import { toasterMachine } from "./toaster.machine"

function make(expand?: boolean) {
  const calls: string[] = []
  const service = createService(
    toasterMachine,
    { expand, onReason: (r, on) => calls.push(`${r}:${on}`) },
    {},
  )
  service.start()
  return { service, calls, state: () => service.getSnapshot().state }
}

describe("toaster machine", () => {
  it("mouse hover expands and reports hover; leaving collapses", () => {
    const m = make()
    m.service.send({ type: "HOVER.START", modality: "pointer" })
    expect(m.state()).toBe("expanded")
    m.service.send({ type: "HOVER.END", modality: "pointer" })
    expect(m.state()).toBe("collapsed")
    expect(m.calls).toEqual(["hover:true", "hover:false"])
  })

  it("touch hover does nothing", () => {
    const m = make()
    m.service.send({ type: "HOVER.START", modality: "touch" })
    expect(m.state()).toBe("collapsed")
    expect(m.calls).toEqual([])
  })

  it("pointer focus pauses without expanding", () => {
    const m = make()
    m.service.send({ type: "FOCUS.ENTER", modality: "pointer" })
    expect(m.state()).toBe("collapsed")
    expect(m.calls).toEqual(["focus:true"])
    m.service.send({ type: "FOCUS.LEAVE", modality: "pointer" })
    expect(m.calls).toEqual(["focus:true", "focus:false"])
  })

  it("keyboard focus expands; leaving collapses", () => {
    const m = make()
    m.service.send({ type: "FOCUS.ENTER", modality: "keyboard" })
    expect(m.state()).toBe("expanded")
    m.service.send({ type: "FOCUS.LEAVE", modality: "keyboard" })
    expect(m.state()).toBe("collapsed")
  })

  it("the hotkey expands and holds focus", () => {
    const m = make()
    m.service.send({ type: "HOTKEY" })
    expect(m.state()).toBe("expanded")
    expect(m.calls).toEqual(["focus:true"])
    m.service.send({ type: "FOCUS.LEAVE", modality: "keyboard" })
    expect(m.state()).toBe("collapsed")
  })

  it("stays expanded while anything else holds: hover and focus", () => {
    const m = make()
    m.service.send({ type: "HOVER.START", modality: "pointer" })
    m.service.send({ type: "FOCUS.ENTER", modality: "keyboard" })
    m.service.send({ type: "HOVER.END", modality: "pointer" })
    expect(m.state()).toBe("expanded")
    m.service.send({ type: "FOCUS.LEAVE", modality: "keyboard" })
    expect(m.state()).toBe("collapsed")
  })

  it("never collapses while a swipe is active; collapses when it ends", () => {
    const m = make()
    m.service.send({ type: "HOVER.START", modality: "pointer" })
    m.service.send({ type: "SWIPING", active: true })
    m.service.send({ type: "HOVER.END", modality: "pointer" })
    expect(m.state()).toBe("expanded")
    m.service.send({ type: "SWIPING", active: false })
    expect(m.state()).toBe("collapsed")
  })

  it("expand:true never collapses", () => {
    const m = make(true)
    m.service.send({ type: "HOVER.START", modality: "pointer" })
    m.service.send({ type: "HOVER.END", modality: "pointer" })
    m.service.send({ type: "HOTKEY" })
    m.service.send({ type: "FOCUS.LEAVE", modality: "keyboard" })
    m.service.send({ type: "SWIPING", active: true })
    m.service.send({ type: "SWIPING", active: false })
    expect(m.state()).toBe("expanded")
  })
})

describe("toaster region unmount", () => {
  it("hover and focus end with the region: no reason and no expansion left behind", () => {
    const reasons: string[] = []
    const props = {
      onReason: (r: string, on: boolean) => reasons.push(`${r}:${on}`),
      visible: true,
    }
    const s = createService(toasterMachine, props as never, {} as never)
    s.start()
    s.send({ type: "HOVER.START", modality: "mouse" })
    s.send({ type: "FOCUS.ENTER", modality: "keyboard" })
    expect(s.getSnapshot().state).toBe("expanded")
    s.setProps({ ...props, visible: false } as never)
    expect(s.getSnapshot().state).toBe("collapsed")
    expect(reasons.slice(-2)).toEqual(["hover:false", "focus:false"])
  })
})
