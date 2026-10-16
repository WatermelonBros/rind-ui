// Hover intent with real layout in real browsers (openspec add-tooltip, hover-intent): the
// grace area between trigger and content, wide content, crossing another trigger, a child
// layer, a web component, scrolling under a resting pointer, focus scrolls, leaving the
// window and leaving nothing behind. Pointer moves are dispatched at coordinates (the
// browser tells what is under them); scrolling and the parked real mouse are the browser's.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { domEnvironment } from "../env/dom-environment"
import type { HoverTriggerProps } from "../env/hover-intent"
import { domHoverIntent } from "./hover-intent"
import { getLayerStack, type LayerHandle, type LayerKind, layerId } from "./layer-stack"

const env = domEnvironment()
const intent = domHoverIntent(env)

let stops: (() => void)[] = []
beforeEach(() => {
  document.body.innerHTML = ""
  document.body.style.cssText = "margin:0"
})
afterEach(() => {
  for (const stop of stops) stop()
  stops = []
  vi.useRealTimers()
  document.body.innerHTML = ""
  document.body.style.cssText = ""
})

interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}
/** An absolutely positioned element at viewport coordinates. */
function box(tag: string, b: Box, parent: ParentNode = document.body, text = "") {
  const el = document.createElement(tag)
  el.style.cssText = `position:fixed;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;margin:0;padding:0;box-sizing:border-box`
  el.textContent = text
  parent.append(el)
  return el
}

/** The deepest element at a point, through open shadow roots. */
function deepAt(x: number, y: number): Element {
  let el: Element = document.elementFromPoint(x, y) ?? document.body
  for (
    let r = el.shadowRoot?.elementFromPoint(x, y);
    r && r !== el;
    r = el.shadowRoot?.elementFromPoint(x, y)
  ) {
    el = r
  }
  return el
}
/** One mouse movement to a point, as the browser would report it. */
function move(x: number, y: number, pointerType = "mouse") {
  deepAt(x, y).dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      composed: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerType,
    }),
  )
}
/** A straight path in 1 px steps from a to b. */
function sweep(from: [number, number], to: [number, number]) {
  const [x0, y0] = from
  const [x1, y1] = to
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  for (let i = 0; i <= n; i++) move(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)
}
const frame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
/** Drains the scroll/resize re-check, which the module runs two frames after the event. */
const drain = async () => {
  for (let i = 0; i < 4; i++) await frame()
}
/** Deterministic timers: nothing fires until advance() passes its delay; frames stay real. */
function manualTimers() {
  let now = 0
  let next = 0
  const pending = new Map<number, { at: number; cb: () => void }>()
  const scheduler = {
    ...env.scheduler,
    setTimeout: (cb: () => void, ms: number) => {
      pending.set(++next, { at: now + ms, cb })
      return next
    },
    clearTimeout: (h: unknown) => {
      pending.delete(h as number)
    },
  }
  const advance = (ms: number) => {
    now += ms
    for (const [h, t] of [...pending]) {
      if (t.at <= now && pending.delete(h)) t.cb()
    }
  }
  return { scheduler, advance, size: () => pending.size }
}

let seq = 0
/** A layer plus hover tracking over a trigger and a content box; counts leaves and enters. */
function open(
  trigger: Element,
  content: Element,
  extra: {
    kind?: LayerKind
    elements?: () => Element[]
    restMs?: number
    hoverIntent?: typeof intent
    target?: () => DOMRect | null
  } = {},
) {
  const id = layerId(`hi-${++seq}`)
  const layer: LayerHandle = getLayerStack(document).push({
    id,
    kind: extra.kind ?? "tooltip",
    modal: false,
    elements: () => [trigger, content],
  })
  const events = { leave: 0, enter: 0, log: [] as string[] }
  const stop = (extra.hoverIntent ?? intent).track({
    trigger: () => trigger,
    elements: extra.elements ?? (() => [content]),
    layer,
    onLeave: () => {
      events.leave++
      events.log.push("leave")
    },
    onEnter: () => {
      events.enter++
      events.log.push("enter")
    },
    ...(extra.restMs !== undefined ? { restMs: extra.restMs } : {}),
    ...(extra.target ? { target: extra.target } : {}),
  })
  const close = () => {
    stop()
    layer.release()
    layer.dispose()
  }
  stops.push(close)
  return { layer, events, stop: close }
}

/** The trigger-side handlers wired to real events; returns what they sent. */
function wire(trigger: Element) {
  const sent: string[] = []
  const props: HoverTriggerProps = intent.triggerProps((e) => sent.push(e.type))
  trigger.addEventListener("pointermove", (e) => props.onPointerMove(e as PointerEvent))
  trigger.addEventListener("pointerleave", (e) => props.onPointerLeave(e as PointerEvent))
  return sent
}

/** Trigger 40x20 at (100,200); content 8 px above it. */
function pair(contentBox: Box = { left: 60, top: 160, width: 120, height: 32 }) {
  const trigger = box("button", { left: 100, top: 200, width: 40, height: 20 }, document.body, "T")
  const content = box("div", contentBox, document.body, "C")
  return { trigger, content }
}

describe("Grace Area", () => {
  it("gap between trigger and content: moving through the 8 px gap never leaves (zag#3181, reka-ui#771)", () => {
    const { trigger, content } = pair() // content bottom 192, trigger top 200
    const { events } = open(trigger, content)
    move(120, 210) // on the trigger
    sweep([120, 210], [120, 170]) // up through the gap onto the content
    expect(events.leave).toBe(0)
    move(120, 175)
    expect(events.leave).toBe(0)
  })

  it("an off-axis path through the gap is still inside the grace area", () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(104, 205)
    sweep([104, 205], [150, 175]) // up and to the right, into the card
    expect(events.leave).toBe(0)
  })

  it("moving back from the content to the trigger through the gap never leaves", () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(120, 175) // on the content
    sweep([120, 175], [120, 210])
    expect(events.leave).toBe(0)
  })

  it("leaving away from the content leaves the zone", () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(120, 210)
    sweep([120, 210], [120, 260])
    expect(events.leave).toBe(1)
  })

  it("leaving sideways off a wide content's trigger is outside the grace area (reka-ui#2203)", () => {
    // Content much wider than the trigger, spanning the viewport; a neighbouring link sits
    // right beside the trigger, level with it.
    const trigger = box("button", { left: 20, top: 300, width: 40, height: 20 }, document.body, "T")
    const content = box("div", { left: 10, top: 240, width: 390, height: 52 }, document.body, "C")
    const link = box("a", { left: 66, top: 300, width: 60, height: 20 }, document.body, "link")
    const { events } = open(trigger, content)
    move(40, 310) // on the trigger
    sweep([40, 310], [61, 310])
    move(70, 310) // onto the neighbouring link
    expect(document.elementFromPoint(70, 310)).toBe(link)
    expect(events.leave, "the pointer is on the neighbouring link").toBe(1)
  })

  it("entering the content removes the grace area; leaving the content sideways leaves", () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(120, 210)
    sweep([120, 210], [120, 175])
    expect(intent.isInTransit(document)).toBe(false)
    sweep([120, 175], [260, 175])
    expect(events.leave).toBe(1)
  })

  it("re-entering the hover zone reports enter once", () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(120, 210)
    move(120, 300)
    expect(events.leave).toBe(1)
    move(120, 210)
    move(121, 210)
    expect(events.enter).toBe(1)
    expect(events.log).toEqual(["leave", "enter"])
  })

  it("only mouse and pen move the zone: a touch pointer moving outside is ignored", () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(120, 210)
    move(120, 300, "touch")
    expect(events.leave).toBe(0)
    move(120, 300, "pen")
    expect(events.leave).toBe(1)
  })

  it("a submenu flipped to the left: the grace area follows the placed target", () => {
    // Requested right of the trigger, placed on its left through `target`.
    const trigger = box(
      "button",
      { left: 200, top: 100, width: 80, height: 24 },
      document.body,
      "T",
    )
    const content = box("div", { left: 100, top: 90, width: 90, height: 120 }, document.body, "C")
    const { events } = open(trigger, content, { target: () => content.getBoundingClientRect() })
    move(220, 112)
    sweep([220, 112], [196, 112]) // left, across the 10 px gap
    sweep([196, 112], [150, 112])
    expect(events.leave).toBe(0)
  })

  it("rest timeout: the grace area ends when the pointer stops inside it", async () => {
    const { trigger, content } = pair()
    const t = manualTimers()
    const { events } = open(trigger, content, {
      restMs: 120,
      hoverIntent: domHoverIntent({ ...env, scheduler: t.scheduler }),
    })
    move(120, 210)
    move(120, 197) // in the gap, stops there
    expect(events.leave).toBe(0)
    t.advance(60)
    expect(events.leave).toBe(0)
    t.advance(120)
    expect(events.leave).toBe(1)
  })

  it("rest timeout restarts with every movement and is off by default", async () => {
    const { trigger, content } = pair()
    const t = manualTimers()
    const a = open(trigger, content, {
      restMs: 120,
      hoverIntent: domHoverIntent({ ...env, scheduler: t.scheduler }),
    })
    move(120, 210)
    move(120, 198)
    t.advance(80)
    move(121, 197)
    t.advance(80)
    expect(a.events.leave).toBe(0)
    a.stop()
    const b = open(trigger, content, {
      hoverIntent: domHoverIntent({ ...env, scheduler: t.scheduler }),
    })
    move(120, 210)
    move(120, 197)
    t.advance(300)
    await drain()
    expect(b.events.leave).toBe(0)
  })
})

describe("In-Transit Suppression", () => {
  it("another trigger crossed on the way into the content does not start opening", () => {
    const trigger1 = box(
      "button",
      { left: 100, top: 200, width: 40, height: 20 },
      document.body,
      "1",
    )
    const trigger2 = box(
      "button",
      { left: 160, top: 170, width: 40, height: 20 },
      document.body,
      "2",
    )
    const content = box("div", { left: 100, top: 100, width: 300, height: 50 }, document.body, "C")
    const sent1 = wire(trigger1)
    const sent2 = wire(trigger2)
    const { events } = open(trigger1, content)
    move(120, 210)
    expect(sent1).toEqual(["HOVER.START"])
    move(138, 199)
    sweep([138, 199], [180, 180]) // diagonally across trigger 2
    expect(document.elementFromPoint(180, 180)).toBe(trigger2)
    expect(intent.isInTransit(document)).toBe(true)
    expect(sent2).toEqual([])
    expect(events.leave).toBe(0)
    // onto the content: the transit ends
    sweep([180, 180], [200, 130])
    expect(intent.isInTransit(document)).toBe(false)
  })

  it("after the transit ends, crossing the other trigger opens it as usual", () => {
    const trigger1 = box(
      "button",
      { left: 100, top: 200, width: 40, height: 20 },
      document.body,
      "1",
    )
    const trigger2 = box(
      "button",
      { left: 300, top: 300, width: 40, height: 20 },
      document.body,
      "2",
    )
    const content = box("div", { left: 100, top: 100, width: 100, height: 50 }, document.body, "C")
    wire(trigger1)
    const sent2 = wire(trigger2)
    const { events } = open(trigger1, content)
    move(120, 210)
    sweep([120, 210], [120, 300])
    expect(events.leave).toBe(1)
    expect(intent.isInTransit(document)).toBe(false)
    move(310, 310)
    expect(sent2).toEqual(["HOVER.START"])
  })

  it("closing the layer ends the transit", () => {
    const { trigger, content } = pair()
    const { stop } = open(trigger, content)
    move(120, 210)
    move(120, 197)
    expect(intent.isInTransit(document)).toBe(true)
    stop()
    expect(intent.isInTransit(document)).toBe(false)
  })
})

describe("Hover Zone", () => {
  it("a descendant layer portalled outside the content keeps the zone: pointer over a child layer (react-spectrum#10460)", () => {
    const trigger = box(
      "button",
      { left: 300, top: 300, width: 40, height: 20 },
      document.body,
      "T",
    )
    const card = box("div", { left: 60, top: 120, width: 200, height: 60 }, document.body, "card")
    const { layer, events } = open(trigger, card, { kind: "popover" })
    // A tooltip opened from a button inside the card, portalled to the body, below the card.
    const child = box("div", { left: 60, top: 180, width: 100, height: 30 }, document.body, "tip")
    getLayerStack(document).push({
      id: layerId("hi-child"),
      kind: "tooltip",
      modal: false,
      parent: layer.id,
      elements: () => [child],
    })
    move(120, 150) // in the card
    sweep([120, 150], [120, 200]) // out of it and onto the child layer
    expect(document.elementFromPoint(120, 200)).toBe(child)
    expect(events.leave).toBe(0)
    move(120, 205)
    expect(events.leave).toBe(0)
  })

  it("a custom element with an open shadow root inside the content counts as inside (ariakit#6303)", () => {
    const { trigger, content } = pair({ left: 60, top: 100, width: 200, height: 80 })
    const host = document.createElement("x-card-body")
    host.style.cssText = "display:block;width:100%;height:100%"
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = '<div id="in" style="width:100%;height:100%">shadow</div>'
    content.append(host)
    const { events } = open(trigger, content)
    move(120, 210)
    sweep([120, 210], [120, 150])
    const inner = shadow.getElementById("in")
    expect(deepAt(120, 150)).toBe(inner)
    move(121, 150)
    move(200, 140)
    expect(events.leave).toBe(0)
  })

  it("content that lives in the shadow root of its own host counts when the host is an element of the layer", () => {
    const trigger = box(
      "button",
      { left: 100, top: 200, width: 40, height: 20 },
      document.body,
      "T",
    )
    const host = box("div", { left: 60, top: 100, width: 200, height: 80 }, document.body)
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = '<div id="in" style="width:200px;height:80px">shadow</div>'
    const { events } = open(trigger, host)
    move(120, 210)
    sweep([120, 210], [120, 150])
    move(130, 140)
    expect(events.leave).toBe(0)
  })

  it("an open nested layer keeps the layer open although the pointer is outside everything (radix#3175)", () => {
    const trigger = box(
      "button",
      { left: 100, top: 200, width: 40, height: 20 },
      document.body,
      "T",
    )
    const card = box("div", { left: 60, top: 120, width: 200, height: 60 }, document.body, "card")
    const { layer, events } = open(trigger, card, { kind: "popover" })
    // A select inside the card: its listbox extends below the card, portalled.
    const listbox = box(
      "div",
      { left: 80, top: 190, width: 120, height: 150 },
      document.body,
      "list",
    )
    const option = box(
      "div",
      { left: 80, top: 250, width: 120, height: 30 },
      document.body,
      "option",
    )
    getLayerStack(document).push({
      id: layerId("hi-listbox"),
      kind: "listbox",
      modal: false,
      parent: layer.id,
      elements: () => [listbox, option],
    })
    move(100, 150)
    move(100, 260) // onto an option
    expect(events.leave).toBe(0)
    move(300, 260) // briefly off the listbox
    expect(events.leave, "a select is open inside: the card stays open").toBe(0)
  })

  it("the pointer on the trigger, the content and the arrow counts as inside", () => {
    const { trigger, content } = pair()
    const arrow = box("div", { left: 110, top: 192, width: 20, height: 8 }, document.body, "a")
    const { events } = open(trigger, content, { elements: () => [content, arrow] })
    move(120, 210)
    move(120, 196)
    move(120, 175)
    expect(events.leave).toBe(0)
  })
})

describe("Scroll And Layout Re-Evaluate The Zone", () => {
  /** A scrollable list with a trigger inside it and the content above the list. */
  function scroller() {
    const list = box("div", { left: 40, top: 200, width: 300, height: 120 }, document.body)
    list.style.overflow = "auto"
    const rows: HTMLElement[] = []
    for (let i = 0; i < 12; i++) {
      const row = document.createElement("button")
      row.style.cssText = "display:block;width:100%;height:30px;box-sizing:border-box;margin:0"
      row.textContent = `row ${i}`
      list.append(row)
      rows.push(row)
    }
    const content = box("div", { left: 40, top: 100, width: 300, height: 40 }, document.body, "C")
    return { list, rows, content }
  }

  it("a container scrolls the trigger away from a resting pointer: the zone is re-evaluated (ariakit#4058)", async () => {
    const { list, rows, content } = scroller()
    const { events } = open(rows[0] as HTMLElement, content)
    move(100, 210) // resting on row 0 (top 200..230)
    expect(events.leave).toBe(0)
    list.scrollTop = 90 // row 0 moves above the list; row 3 is under the pointer now
    await drain()
    expect(events.leave).toBe(1)
  })

  it("a container scrolls the trigger away downwards (towards the end of the grace area's source)", async () => {
    const { list, rows, content } = scroller()
    list.scrollTop = 120 // rows 4.. are visible
    const { events } = open(rows[4] as HTMLElement, content)
    move(100, 215) // on row 4 (top 200..230 after the scroll)
    expect(events.leave).toBe(0)
    list.scrollTop = 0 // row 4 moves down to 320: the pointer is over row 0
    await drain()
    expect(events.leave, "the trigger moved away from the resting pointer").toBe(1)
  })

  it("a pointer that rested on the trigger before the layer opened is still known: scrolling it away closes (spec scenario, ariakit#4058)", async () => {
    // The real flow: the pointer moves onto the trigger (trigger handlers), the open delay
    // passes with no further movement, THEN the layer opens and tracking starts.
    const { list, rows, content } = scroller()
    // Resting on row 0 before any tracking exists: only the trigger's own handler saw it.
    intent
      .triggerProps(() => {})
      .onPointerMove({
        pointerType: "mouse",
        currentTarget: rows[0] as HTMLElement,
        clientX: 100,
        clientY: 210,
      })
    const { events } = open(rows[0] as HTMLElement, content)
    list.scrollTop = 90
    await drain()
    expect(events.leave, "the trigger scrolled away from the resting pointer").toBe(1)
  })

  it("scrolling that keeps the trigger under the pointer changes nothing", async () => {
    const { list, rows, content } = scroller()
    rows[0]?.style.setProperty("height", "200px")
    const { events } = open(rows[0] as HTMLElement, content)
    move(100, 210)
    list.scrollTop = 20
    await drain()
    expect(events.leave).toBe(0)
  })

  it("a page scroll is seen too (capture on the document)", async () => {
    document.body.style.height = "3000px"
    const trigger = box(
      "button",
      { left: 100, top: 200, width: 40, height: 20 },
      document.body,
      "T",
    )
    trigger.style.position = "absolute"
    trigger.style.top = "200px"
    const content = box("div", { left: 60, top: 100, width: 120, height: 40 }, document.body, "C")
    content.style.position = "absolute"
    const { events } = open(trigger, content)
    move(120, 210)
    window.scrollTo(0, 150)
    await drain()
    expect(events.leave).toBe(1)
    window.scrollTo(0, 0)
  })

  it("scrolling does not affect a layer open only by keyboard focus (radix#1944, react-spectrum#10333)", async () => {
    const { list, rows, content } = scroller()
    const { events } = open(rows[8] as HTMLElement, content)
    // focus() scrolls the row into view; no pointer was ever over the layer
    rows[8]?.focus()
    list.scrollTop = 120
    await frame()
    window.scrollBy(0, 1)
    await drain()
    expect(events.leave).toBe(0)
  })

  it("a viewport resize re-checks the zone", async () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(120, 210)
    trigger.style.top = "400px" // layout shifted under the pointer
    window.dispatchEvent(new Event("resize"))
    expect(events.leave).toBe(1)
  })
})

describe("Opening Delay And Movement (trigger handlers)", () => {
  it("HOVER.START once per stay, on pointer movement only, HOVER.END on leave", () => {
    const { trigger } = pair()
    const sent = wire(trigger)
    move(110, 205)
    move(111, 205)
    move(112, 206)
    expect(sent).toEqual(["HOVER.START"])
    trigger.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }))
    expect(sent).toEqual(["HOVER.START", "HOVER.END"])
    move(110, 205)
    expect(sent).toEqual(["HOVER.START", "HOVER.END", "HOVER.START"])
  })

  it("touch pointers never start or end hover", () => {
    const { trigger } = pair()
    const sent = wire(trigger)
    move(110, 205, "touch")
    trigger.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "touch" }))
    expect(sent).toEqual([])
  })

  it("pointer enter, over and boundary events without movement start nothing", () => {
    const { trigger } = pair()
    const sent = wire(trigger)
    for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter"]) {
      trigger.dispatchEvent(
        new PointerEvent(type, { pointerType: "mouse", bubbles: type.endsWith("over") }),
      )
    }
    expect(sent).toEqual([])
  })

  it("a trigger scrolled under a resting real mouse does not start opening until the mouse moves (ariakit#1662)", async () => {
    const list = box("div", { left: 20, top: 100, width: 260, height: 160 }, document.body)
    list.style.overflow = "auto"
    const pad = document.createElement("div")
    pad.style.cssText = "height:400px"
    const trigger = document.createElement("button")
    trigger.style.cssText = "display:block;width:100%;height:40px;margin:0"
    trigger.textContent = "T"
    list.append(pad, trigger)
    const sent = wire(trigger)
    // park the real mouse over the list where the trigger will arrive
    await userEvent.hover(list)
    const r = list.getBoundingClientRect()
    list.scrollTop = 400 - r.height / 2 + 20 // trigger centred under the list's centre
    await drain()
    expect(sent, "no movement: nothing started").toEqual([])
    await userEvent.unhover(list)
  })

  it("a pointer already resting on a trigger when it mounts starts on its first movement", () => {
    const sent: string[] = []
    const trigger = box(
      "button",
      { left: 100, top: 200, width: 40, height: 20 },
      document.body,
      "T",
    )
    const props = intent.triggerProps((e) => sent.push(e.type))
    trigger.addEventListener("pointermove", (e) => props.onPointerMove(e as PointerEvent))
    expect(sent).toEqual([])
    move(120, 210)
    expect(sent).toEqual(["HOVER.START"])
  })
})

describe("Leaving The Document", () => {
  it("the pointer leaving the document counts as leaving the zone (radix#3299)", () => {
    // A tooltip touching the window edge: the pointer is over it, then exits the window.
    const trigger = box("button", { left: 100, top: 40, width: 40, height: 20 }, document.body, "T")
    const content = box("div", { left: 60, top: 0, width: 120, height: 32 }, document.body, "C")
    const { events } = open(trigger, content)
    move(120, 10)
    expect(events.leave).toBe(0)
    document.documentElement.dispatchEvent(
      new PointerEvent("pointerleave", { pointerType: "mouse" }),
    )
    expect(events.leave).toBe(1)
  })

  it("the window losing focus counts as leaving the zone, and moving back re-enters", () => {
    const { trigger, content } = pair()
    const { events } = open(trigger, content)
    move(120, 210)
    window.dispatchEvent(new Event("blur"))
    expect(events.leave).toBe(1)
    move(121, 210)
    expect(events.enter).toBe(1)
  })
})

describe("Nothing Left Behind", () => {
  /** Records every listener added and removed on the document, its element and the window. */
  function listenerLog() {
    const targets: EventTarget[] = [
      document,
      document.documentElement,
      window,
      ...(window.visualViewport ? [window.visualViewport] : []),
    ]
    const live = new Map<string, number>()
    const key = (t: EventTarget, type: string, o: unknown) =>
      `${t === document ? "document" : t === window ? "window" : t === document.documentElement ? "html" : "viewport"}:${type}:${typeof o === "boolean" ? o : (o as { capture?: boolean } | undefined)?.capture === true}`
    const add = vi.fn()
    for (const t of targets) {
      const a = t.addEventListener.bind(t)
      const r = t.removeEventListener.bind(t)
      vi.spyOn(t, "addEventListener").mockImplementation((type, l, o) => {
        add()
        const k = key(t, type, o)
        live.set(k, (live.get(k) ?? 0) + 1)
        a(type, l, o as never)
      })
      vi.spyOn(t, "removeEventListener").mockImplementation((type, l, o) => {
        const k = key(t, type, o)
        live.set(k, (live.get(k) ?? 0) - 1)
        r(type, l, o as never)
      })
    }
    return { live: () => [...live].filter(([, n]) => n !== 0).map(([k]) => k), add }
  }

  it("closed: only the trigger's own handlers exist, no document or window listener", () => {
    const { trigger } = pair()
    const log = listenerLog()
    const sent = wire(trigger)
    move(120, 210)
    expect(sent).toEqual(["HOVER.START"])
    expect(log.add).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it("open then stopped: every pointer, scroll, resize and blur listener is removed", () => {
    const { trigger, content } = pair()
    const log = listenerLog()
    const { stop } = open(trigger, content)
    expect(log.live().length).toBeGreaterThan(0)
    stop()
    expect(log.live()).toEqual([])
    vi.restoreAllMocks()
  })

  it("no timer remains after stopping with a rest timeout and a pending grace area", async () => {
    const { trigger, content } = pair()
    const events = { leave: 0 }
    const layer = getLayerStack(document).push({
      id: layerId("hi-timers"),
      kind: "tooltip",
      modal: false,
      elements: () => [trigger, content],
    })
    const t = manualTimers()
    const tracked = domHoverIntent({ ...env, scheduler: t.scheduler })
    const stop = tracked.track({
      trigger: () => trigger,
      elements: () => [content],
      layer,
      onLeave: () => events.leave++,
      onEnter: () => {},
      restMs: 100,
    })
    move(120, 210)
    move(120, 197)
    expect(t.size()).toBe(1)
    stop()
    expect(t.size()).toBe(0)
    t.advance(200)
    await drain()
    expect(events.leave).toBe(0)
    layer.release()
    layer.dispose()
  })

  it("after stop, pointer movement and scrolling report nothing", async () => {
    const { trigger, content } = pair()
    const { events, stop } = open(trigger, content)
    move(120, 210)
    stop()
    move(120, 400)
    window.dispatchEvent(new Event("blur"))
    document.documentElement.dispatchEvent(
      new PointerEvent("pointerleave", { pointerType: "mouse" }),
    )
    window.dispatchEvent(new Event("resize"))
    await frame()
    expect(events.leave).toBe(0)
  })
})
