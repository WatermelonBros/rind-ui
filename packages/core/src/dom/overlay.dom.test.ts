import { afterEach, describe, expect, it } from "vitest"
import { domEnvironment } from "../env/dom-environment"
import type { DismissReason } from "./dismiss"
import { getLayerStack, layerId } from "./layer-stack"
import { type OverlayEffectOptions, overlayEffect } from "./overlay"
import { platforms } from "./platform"

const ATTR = "data-rind-scroll-locked"
const html = document.documentElement
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
/** A released layer is disposed a frame later, once its exit animations settle. */
const exited = async () => {
  await frame()
  await frame()
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
  document.body.innerHTML = ""
  html.removeAttribute("style")
  html.removeAttribute(ATTR)
})

// An emptied `style=""` is not a leftover (jsdom keeps the attribute, browsers drop it).
const attrs = (el: Element) =>
  el
    .getAttributeNames()
    .filter((n) => n !== "style" || el.getAttribute(n) !== "")
    .sort()
const snapshot = () => ({
  html: [attrs(html), html.style.cssText],
  body: [attrs(document.body), document.body.style.cssText],
})
const anyInert = () => document.querySelector("[inert]") !== null
const locked = () =>
  [html, document.body].some((el) => el.hasAttribute(ATTR) || el.style.overflow === "hidden")

function setup() {
  document.body.innerHTML = `
    <div id="app"><button id="trigger">open</button></div>
    <div id="content" role="dialog"><input id="field" /><button id="btn">ok</button></div>`
  const env = domEnvironment({ platform: platforms.windows })
  cleanups.push(env.modality.subscribe(() => {}))
  q("#trigger").focus()
  return { env, trigger: q("#trigger"), content: q("#content") }
}

/** Opens the dialog; `stop` is the overlay cleanup, `requests` the dismiss reasons seen. */
function openDialog(extra: Partial<OverlayEffectOptions> = {}) {
  const ctx = setup()
  const requests: (DismissReason | undefined)[] = []
  let stop = () => {}
  stop = overlayEffect(ctx.env, {
    id: layerId("d"),
    kind: "dialog",
    modal: true,
    elements: () => [ctx.content],
    container: () => ctx.content,
    opener: () => ctx.trigger,
    modality: "keyboard",
    dismiss: {
      onRequest: (r) => {
        requests.push(r.reason)
        stop()
      },
    },
    ...extra,
  })
  cleanups.push(() => stop())
  return { ...ctx, requests, stop: () => stop() }
}

const pressEscape = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

describe("modal overlayEffect", () => {
  it("focuses in, makes the app inert and locks scroll", async () => {
    const { content } = openDialog()
    await frame()
    expect(document.activeElement).toBe(q("#field"))
    expect(content.contains(document.activeElement)).toBe(true)
    expect(q("#app").hasAttribute("inert")).toBe(true)
    expect(content.hasAttribute("inert")).toBe(false)
    expect(locked()).toBe(true)
  })

  it("Escape requests a dismiss; the cleanup restores focus to the (formerly inert) trigger", async () => {
    const { requests, trigger } = openDialog()
    await frame()
    pressEscape()
    expect(requests).toEqual(["escape-key"])
    expect(q("#app").hasAttribute("inert")).toBe(false)
    expect(locked()).toBe(false)
    expect(document.activeElement).toBe(trigger)
    // The released content stays inert while it exits (nothing animates here: one frame).
    await exited()
    expect(anyInert()).toBe(false)
  })

  it("an unmount mid-open leaves html and body attributes and styles as they were", () => {
    const ctx = setup()
    const reference = snapshot()
    const stop = overlayEffect(ctx.env, {
      id: layerId("d"),
      kind: "dialog",
      modal: true,
      elements: () => [ctx.content],
      container: () => ctx.content,
      opener: () => ctx.trigger,
      modality: "keyboard",
      dismiss: { onRequest: () => {} },
    })
    expect(locked()).toBe(true)
    stop()
    expect(snapshot()).toEqual(reference)
  })

  it("dismisses a nested menu (parent-dismissed) before the dialog is released", async () => {
    const { env, content, stop } = openDialog()
    await frame()
    const menu = document.createElement("div")
    content.append(menu)
    const order: string[] = []
    const stack = getLayerStack(document)
    let stopMenu = () => {}
    stopMenu = overlayEffect(env, {
      id: layerId("m"),
      kind: "menu",
      modal: false,
      parent: layerId("d"),
      elements: () => [menu],
      container: () => menu,
      modality: "keyboard",
      dismiss: {
        onRequest: (r) => {
          order.push(`${r.reason}:dialogOpen=${!!stack.get(layerId("d"))}`)
          stopMenu()
        },
      },
    })
    cleanups.push(() => stopMenu())
    stop()
    expect(order).toEqual(["parent-dismissed:dialogOpen=true"])
    expect(stack.layers()).toHaveLength(0)
  })

  it("passes the dismiss reason to finalFocus (undefined when closed programmatically)", async () => {
    const seen: (DismissReason | undefined)[] = []
    const a = openDialog({
      finalFocus: (r) => {
        seen.push(r)
        return null
      },
    })
    await frame()
    pressEscape()
    expect(seen).toEqual(["escape-key"])
    expect(a.requests).toEqual(["escape-key"])
    document.body.innerHTML = ""

    const b = openDialog({
      finalFocus: (r) => {
        seen.push(r)
        return null
      },
    })
    await frame()
    b.stop()
    expect(seen).toEqual(["escape-key", undefined])
  })

  it("finalFocus false keeps focus where it is", async () => {
    const { stop, trigger } = openDialog({ finalFocus: () => false })
    await frame()
    stop()
    // Not moved to the trigger (the closing content being inert may still blur it to body).
    expect(document.activeElement).not.toBe(trigger)
  })

  it("onExiting hands over a dispose: exiting until called, gone after", async () => {
    let dispose = () => {}
    const { stop } = openDialog({
      onExiting: (d) => {
        dispose = d
      },
    })
    await frame()
    const stack = getLayerStack(document)
    stop()
    expect(stack.layers()).toHaveLength(0)
    expect(stack.exiting().map((l) => l.id)).toEqual([layerId("d")])
    // The page is usable again; only the closing content stays inert until presence is done.
    expect(q("#app").hasAttribute("inert")).toBe(false)
    expect(q("#content").hasAttribute("inert")).toBe(true)
    dispose()
    expect(stack.exiting()).toHaveLength(0)
    expect(anyInert()).toBe(false)
  })

  it("a released layer stays exiting until its parts settle (react-spectrum#10291)", async () => {
    const { stop } = openDialog()
    await frame()
    stop()
    const stack = getLayerStack(document)
    expect(stack.layers()).toHaveLength(0)
    expect(stack.exiting()).toHaveLength(1)
    await exited()
    expect(stack.exiting()).toHaveLength(0)
  })

  it("survives start, cleanup, start again (Strict Mode)", async () => {
    const ctx = setup()
    const reference = snapshot()
    const start = () =>
      overlayEffect(ctx.env, {
        id: layerId("d"),
        kind: "dialog",
        modal: true,
        elements: () => [ctx.content],
        container: () => ctx.content,
        opener: () => ctx.trigger,
        modality: "keyboard",
        dismiss: { onRequest: () => {} },
      })
    start()()
    const stop = start()
    await frame()
    const stack = getLayerStack(document)
    expect(stack.layers()).toHaveLength(1)
    expect(stack.exiting()).toHaveLength(0)
    expect(locked()).toBe(true)
    stop()
    expect(locked()).toBe(false)
    await exited()
    expect(anyInert()).toBe(false)
    expect(snapshot()).toEqual(reference)
  })

  it("a non-modal overlay neither hides the page nor locks scroll", async () => {
    const ctx = setup()
    const stop = overlayEffect(ctx.env, {
      id: layerId("p"),
      kind: "popover",
      modal: false,
      elements: () => [ctx.content],
      container: () => ctx.content,
      opener: () => ctx.trigger,
      modality: "keyboard",
      dismiss: { onRequest: () => {} },
    })
    cleanups.push(stop)
    await frame()
    expect(anyInert()).toBe(false)
    expect(locked()).toBe(false)
  })

  it("attaches focus, containment and inert to content that mounts many frames later", async () => {
    const ctx = setup()
    ctx.content.remove()
    const stop = overlayEffect(ctx.env, {
      id: layerId("late"),
      kind: "dialog",
      modal: true,
      elements: () => (ctx.content.isConnected ? [ctx.content] : []),
      container: () => (ctx.content.isConnected ? ctx.content : null),
      opener: () => ctx.trigger,
      modality: "keyboard",
      dismiss: { onRequest: () => {} },
    })
    cleanups.push(stop)
    for (let i = 0; i < 15; i++) await frame()
    document.body.append(ctx.content)
    await frame()
    await frame()
    expect(document.activeElement).toBe(q("#field"))
    expect(q("#app").closest("[inert]")).not.toBeNull()
  })

  it("keeps an autoFocus field the content focused before attach", async () => {
    const ctx = setup()
    ctx.content.remove()
    const stop = overlayEffect(ctx.env, {
      id: layerId("auto"),
      kind: "dialog",
      modal: true,
      elements: () => (ctx.content.isConnected ? [ctx.content] : []),
      container: () => (ctx.content.isConnected ? ctx.content : null),
      opener: () => ctx.trigger,
      modality: "keyboard",
      dismiss: { onRequest: () => {} },
    })
    cleanups.push(stop)
    // The framework mounts the content and its autoFocus button, then the effect attaches.
    document.body.append(ctx.content)
    q("#btn").focus()
    await frame()
    await frame()
    await frame()
    expect(document.activeElement).toBe(q("#btn"))
  })
})
