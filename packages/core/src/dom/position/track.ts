// domPositioning(): one tracking per open popup. Passes are async (Floating UI) and carry a
// token, so a pass that ends after close, an anchor change or a newer pass writes nothing.
// Continuous values are written as CSS custom properties on the positioner, only when they
// change; discrete results (side, align, anchor hidden, first placement) go to the machine.
// Every trigger after the first pass is coalesced into the next frame, so our own size
// writes never re-enter a ResizeObserver delivery. Nothing exists while closed.

import {
  autoUpdate,
  computePosition,
  type Placement as FloatingPlacement,
  platform,
  type ReferenceElement,
} from "@floating-ui/dom"
import type { DomEnv, SchedulerEnv } from "../../env/capabilities"
import type {
  AnchorSource,
  Placement,
  PositionHandle,
  Positioning,
  PositionRequest,
} from "../../env/position"
import { cssZoom } from "../css-zoom"

// Floating UI sizes the floating element (and the arrow) by its layout box, which CSS zoom does
// not scale, but measures the anchor in viewport pixels: in a zoomed page the two disagree and a
// popup above its anchor overlaps it. The layout size times the element's zoom is its viewport
// size, the same unit as everything else (css-zoom.ts).
const zoomed: typeof platform = {
  ...platform,
  getDimensions: async (el) => {
    const d = await platform.getDimensions(el)
    const z = cssZoom(el)
    return z === 1 ? d : { width: d.width * z, height: d.height * z }
  },
}

import { getLayerStack } from "../layer-stack"
import { middlewareFor, type SizeReport, splitPlacement, transformOrigin } from "./middleware"
import { paddingOf, physicalSide, placementOf, snap } from "./options"
import { resolveStrategy } from "./strategy"

/** Writes custom properties on an element, skipping values that did not change. */
function writer(el: HTMLElement) {
  const last = new Map<string, string>()
  return (prop: string, value: string) => {
    if (last.get(prop) === value) return
    last.set(prop, value)
    el.style.setProperty(prop, value)
  }
}

/**
 * `inline`: an anchor wrapping across lines is placed against one line box: the one nearest
 * the pointer, else the first line (Floating UI's own `inline` picks the last of connected
 * lines).
 */
function lineBox(
  ref: ReferenceElement | null,
  contextElement: Element | null,
  inline: true | { readonly x: number; readonly y: number },
): ReferenceElement | null {
  const rects =
    ref && "getClientRects" in ref && ref.getClientRects ? Array.from(ref.getClientRects()) : []
  if (rects.length < 2) return ref
  const p = inline === true ? null : inline
  const distance = (r: (typeof rects)[number]) =>
    p
      ? Math.hypot(
          Math.max(r.left - p.x, 0, p.x - r.right),
          Math.max(r.top - p.y, 0, p.y - r.bottom),
        )
      : 0
  const chosen = p ? rects.reduce((a, b) => (distance(b) < distance(a) ? b : a)) : rects[0]
  if (!chosen) return ref
  const box = {
    x: chosen.left,
    y: chosen.top,
    width: chosen.width,
    height: chosen.height,
    top: chosen.top,
    left: chosen.left,
    right: chosen.right,
    bottom: chosen.bottom,
  }
  return contextElement
    ? { getBoundingClientRect: () => box, contextElement }
    : { getBoundingClientRect: () => box }
}

/** An element anchor with no layout box (display: none, detached) counts as hidden. */
const noBox = (el: Element | null) => !el?.isConnected || el.getClientRects().length === 0

export function domPositioning(env: DomEnv & SchedulerEnv): Positioning {
  const active = new Map<string, PositionHandle>()

  function track(r: PositionRequest): PositionHandle {
    let token = 0
    let stopped = false
    let first = true
    let settled = false
    let last: Placement | null = null
    let lock: FloatingPlacement | null = null
    let strategy: "absolute" | "fixed" | null = null
    let frame: unknown = null
    const cleanups: (() => void)[] = []
    let anchorKey: unknown = null
    let write: ((prop: string, value: string) => void) | null = null

    const anchorElement = (a: AnchorSource) =>
      a.kind === "element"
        ? env.dom.getById(a.id)
        : a.kind === "virtual"
          ? (a.get()?.contextElement ?? null)
          : null
    const reference = (a: AnchorSource): ReferenceElement | null => {
      if (a.kind === "element") return env.dom.getById(a.id)
      if (a.kind === "virtual") return a.get()
      const { x, y } = a
      const rect = { x, y, width: 0, height: 0, top: y, left: x, right: x, bottom: y }
      return { getBoundingClientRect: () => rect }
    }

    const report = (p: Placement) => {
      const changed =
        !last ||
        last.side !== p.side ||
        last.align !== p.align ||
        last.anchorHidden !== p.anchorHidden
      last = p
      if (first || changed) {
        const wasFirst = first
        first = false
        r.onPlacement(p, wasFirst)
      }
    }

    const requested = (): Placement => {
      const o = r.options()
      const floating = env.dom.getById(r.positioner)
      const dir = floating?.closest("[dir]")?.getAttribute("dir") === "rtl" ? "rtl" : "ltr"
      return { side: physicalSide(o.side, dir), align: o.align, anchorHidden: false }
    }

    const pass = async () => {
      if (stopped) return
      const my = ++token
      const o = r.options()
      const floating = env.dom.getById(r.positioner)
      if (!floating) return
      // Manual mode: the consumer's CSS places it; placed at once, as requested.
      if (o.mode === "manual") return report(requested())
      const anchorEl = anchorElement(r.anchor)
      const ref = o.inline ? lineBox(reference(r.anchor), anchorEl, o.inline) : reference(r.anchor)
      const refRect = ref?.getBoundingClientRect()
      const floatRect = floating.getBoundingClientRect()
      // No layout (jsdom, display: none everywhere): placed as requested, nothing written.
      if (
        !ref ||
        !refRect ||
        (refRect.width === 0 &&
          refRect.height === 0 &&
          floatRect.width === 0 &&
          floatRect.height === 0 &&
          r.anchor.kind !== "point")
      ) {
        return report({
          ...requested(),
          anchorHidden: r.anchor.kind === "element" && noBox(anchorEl),
        })
      }
      const dir = floating.getAttribute("dir") === "rtl" ? "rtl" : "ltr"
      const side = physicalSide(o.side, dir)
      strategy ??= resolveStrategy(o.strategy, floating, r.anchor, anchorEl)
      const arrowEl = r.arrow ? env.dom.getById(r.arrow) : null
      const boundaryOpt =
        typeof o.collisionBoundary === "function"
          ? o.collisionBoundary()
          : (o.collisionBoundary ?? null)
      const sized: { current: SizeReport | null } = { current: null }
      let result: Awaited<ReturnType<typeof computePosition>>
      // Measure in the containing block the coordinates will be applied in: while placing,
      // the positioner is `fixed` at the origin (invisible), but an `absolute` popup is placed
      // relative to its offset parent (a positioned host, a shadow host).
      const shown = floating.style.getPropertyValue("position")
      const shownPriority = floating.style.getPropertyPriority("position")
      floating.style.setProperty("position", strategy)
      try {
        result = await computePosition(ref, floating, {
          placement: lock ?? placementOf(side, o.align),
          strategy,
          platform: zoomed,
          middleware: middlewareFor(
            o,
            side,
            {
              arrow: arrowEl,
              boundary: boundaryOpt,
              onSize: (s) => {
                sized.current = s
              },
            },
            lock,
          ),
        })
      } catch {
        // A detached or unmeasurable element mid-pass: keep the last placement.
        return
      } finally {
        // The framework's style (first frame or placed) owns `position` again.
        if (shown === "") floating.style.removeProperty("position")
        else floating.style.setProperty("position", shown, shownPriority)
      }
      // Stale: closed, superseded, or the anchor changed while the pass ran.
      // (Compares the anchor element itself: `ref` may be a line box built from it.)
      if (stopped || my !== token) return
      if (r.anchor.kind === "element" && anchorElement(r.anchor) !== anchorEl) return
      const view = floating.ownerDocument.defaultView
      const dpr = view?.devicePixelRatio ?? 1
      // Floating UI measures in viewport pixels; lengths written for the floating element are
      // multiplied by its CSS zoom, so they are divided by it first (css-zoom.ts).
      const zoom = cssZoom(floating)
      const u = (n: number) => n / zoom
      write ??= writer(floating)
      write("--rind-position", strategy)
      // For tests (the layout invariant): the effective padding, and which element anchors it.
      const pad = paddingOf(o.collisionPadding)
      write("--rind-collision-padding", `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`)
      write("--rind-anchor-id", r.anchor.kind === "element" ? r.anchor.id : "")
      write("--rind-x", `${snap(u(result.x), dpr)}px`)
      write("--rind-y", `${snap(u(result.y), dpr)}px`)
      const s = sized.current
      if (s) {
        write("--rind-available-width", `${u(Math.max(0, s.availableWidth))}px`)
        write("--rind-available-height", `${u(Math.max(0, s.availableHeight))}px`)
        write("--rind-anchor-width", `${snap(u(s.anchorWidth), dpr)}px`)
        write("--rind-anchor-height", `${snap(u(s.anchorHeight), dpr)}px`)
      }
      const placed = splitPlacement(result.placement)
      const arrowData = result.middlewareData.arrow
      if (arrowEl && arrowData) {
        write("--rind-arrow-x", arrowData.x == null ? "" : `${snap(u(arrowData.x), dpr)}px`)
        write("--rind-arrow-y", arrowData.y == null ? "" : `${snap(u(arrowData.y), dpr)}px`)
        // The arrow cannot point at the anchor's centre within the padding.
        arrowEl.toggleAttribute("data-uncentered", (arrowData.centerOffset ?? 0) !== 0)
      }
      const arrowRect = arrowEl?.getBoundingClientRect()
      write(
        "--rind-transform-origin",
        transformOrigin({
          ...placed,
          rtl: dir === "rtl",
          floating: {
            x: u(result.x),
            y: u(result.y),
            width: u(floatRect.width),
            height: u(floatRect.height),
          },
          arrow:
            arrowEl && arrowRect && arrowData
              ? {
                  x: arrowData.x == null ? arrowData.x : u(arrowData.x),
                  y: arrowData.y == null ? arrowData.y : u(arrowData.y),
                  width: u(arrowRect.width),
                  height: u(arrowRect.height),
                }
              : undefined,
          point: r.anchor.kind === "point" ? { x: u(r.anchor.x), y: u(r.anchor.y) } : undefined,
        }),
      )
      const hidden =
        result.middlewareData.hide?.referenceHidden === true ||
        (r.anchor.kind === "element" && noBox(anchorEl))
      // The first pass measured the popup under the seeded 100vh cap: once the available
      // size is written, measure again before reporting (no flash at a wrong position).
      if (first && !settled) {
        settled = true
        return pass()
      }
      if (o.sideLock === "open" && lock === null) lock = result.placement
      report({ ...placed, anchorHidden: hidden })
    }

    /** Every trigger after the first pass: one pass in the next frame. */
    const schedule = () => {
      if (stopped || frame !== null) return
      frame = env.scheduler.requestAnimationFrame(() => {
        frame = null
        void pass()
      })
    }

    const stopListening = () => {
      for (const c of cleanups.splice(0)) c()
    }

    const listen = () => {
      stopListening()
      const o = r.options()
      const floating = env.dom.getById(r.positioner)
      const ref = reference(r.anchor)
      anchorKey = r.anchor.kind === "element" ? ref : r.anchor
      if (!floating || o.mode === "manual" || o.tracking === "none") return
      const doc = floating.ownerDocument
      const view = doc.defaultView
      if (ref) {
        cleanups.push(
          autoUpdate(ref, floating, schedule, {
            animationFrame: o.tracking === "frame",
          }),
        )
      }
      // What autoUpdate does not watch: the visual viewport (keyboard, pinch-zoom), the layer
      // stack (scroll lock reserving a gutter), and animations ending on the anchor's ancestors.
      const vv = view?.visualViewport
      if (vv) {
        vv.addEventListener("resize", schedule)
        vv.addEventListener("scroll", schedule)
        cleanups.push(() => {
          vv.removeEventListener("resize", schedule)
          vv.removeEventListener("scroll", schedule)
        })
      }
      cleanups.push(getLayerStack(doc).subscribe(schedule))
      const anchorEl = anchorElement(r.anchor)
      const onEnd = (e: Event) => {
        if (anchorEl && e.target instanceof Node && e.target.contains(anchorEl)) schedule()
      }
      doc.addEventListener("animationend", onEnd, true)
      doc.addEventListener("transitionend", onEnd, true)
      // The document is discarded (iframe removed, navigation): nothing stays registered.
      const onHide = () => stopListening()
      view?.addEventListener("pagehide", onHide)
      cleanups.push(() => {
        doc.removeEventListener("animationend", onEnd, true)
        doc.removeEventListener("transitionend", onEnd, true)
        view?.removeEventListener("pagehide", onHide)
      })
    }

    const handle: PositionHandle = {
      reposition() {
        if (stopped) return
        // A new anchor element: tracking restarts against it.
        const ref = reference(r.anchor)
        if (r.anchor.kind === "element" && ref !== anchorKey) listen()
        void pass()
      },
      stop() {
        if (stopped) return
        stopped = true
        token++
        if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
        stopListening()
        if (active.get(r.positioner) === handle) active.delete(r.positioner)
      },
    }
    /** The positioner may mount a frame after the open (a framework renders it next). */
    const start = () => {
      if (stopped) return
      if (!env.dom.getById(r.positioner)) {
        frame = env.scheduler.requestAnimationFrame(() => {
          frame = null
          start()
        })
        return
      }
      listen()
      void pass()
    }
    active.set(r.positioner, handle)
    start()
    return handle
  }

  return {
    track,
    reposition: (positioner) => active.get(positioner)?.reposition(),
  }
}
