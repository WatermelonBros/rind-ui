// scroll-metrics (add-scroll-area design §2): the only module that touches a Scroll Area's
// layout. It measures the Viewport (all reads, then all writes, at most once per animation
// frame), draws thumbs and CSS variables straight into the DOM, forwards wheels that land on
// its own scrollbars, runs thumb drags through pointer-drag, and sends the machine only
// discrete facts. One `stop()` removes every listener, observer and pending frame.

import type {
  AxisFlags,
  EdgeFlags,
  ScrollAxis,
  ScrollMetricsCapability,
} from "../components/scroll-area/scroll-area.machine"
import type { DomEnv, ModalityEnv, SchedulerEnv, StyleEnv } from "../env/capabilities"
import { partId } from "../ids"
import { tabbables } from "./focus-scope"
import { injectStyle } from "./inject-style"
import { isDragPress, pointerDragSession } from "./pointer-drag"

/** Native scrollbars hidden, `overflow: auto`, Content a containing block; any rule wins. */
export const SCROLL_AREA_RULE = [
  '[data-scope="scroll-area"][data-part="viewport"] { overflow: auto; scrollbar-width: none }',
  '[data-scope="scroll-area"][data-part="viewport"]::-webkit-scrollbar { display: none }',
  '[data-scope="scroll-area"][data-part="content"] { position: relative }',
].join("\n")

export const scrollAreaIds = (root: string) => ({
  root: partId("scroll-area", root, "root"),
  viewport: partId("scroll-area", root, "viewport"),
  content: partId("scroll-area", root, "content"),
  scrollbar: (axis: ScrollAxis) => partId("scroll-area", root, `scrollbar-${axis}`),
  thumb: (axis: ScrollAxis) => partId("scroll-area", root, `thumb-${axis}`),
  corner: partId("scroll-area", root, "corner"),
})

/** A scroll range normalised to `[min, min + max]`; reversed axes run from `-max` to 0. */
export interface AxisRange {
  readonly pos: number
  readonly min: number
  readonly max: number
}

/** Fraction (0 to 1) of the way from the physical top / left; 0 when nothing scrolls. */
export function physicalFraction(r: AxisRange): number {
  if (!(r.max > 0)) return 0
  const f = (r.pos - r.min) / r.max
  return Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0
}

/** Is the axis reversed? Horizontal: RTL XOR row-reverse; vertical: column-reverse. */
export const isReversed = (axis: ScrollAxis, direction: string, flexDirection: string) =>
  axis === "x"
    ? (direction === "rtl") !== (flexDirection === "row-reverse")
    : flexDirection === "column-reverse"

/** The next scroll position for a wheel delta, clamped to the range. */
export const wheelTarget = (r: AxisRange, delta: number) =>
  Math.min(r.min + r.max, Math.max(r.min, r.pos + delta))

const px = (v: string) => Number.parseFloat(v) || 0
const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll"

type Env = DomEnv & SchedulerEnv & Partial<ModalityEnv> & Partial<StyleEnv>

/** A measure split in two: `read` touches layout only and returns the writes to make. */
type Job = () => (() => void) | null

/**
 * One animation frame per document for every Scroll Area on it: all reads first, then all
 * writes, so 30 areas never interleave a layout read after a style write (mui/base-ui#3534).
 */
const queues = new WeakMap<
  Document,
  { jobs: Set<Job>; frame: unknown; scheduler: Env["scheduler"] }
>()

function enqueue(doc: Document, scheduler: Env["scheduler"], job: Job): void {
  let q = queues.get(doc)
  if (!q) {
    q = { jobs: new Set(), frame: null, scheduler }
    queues.set(doc, q)
  }
  q.jobs.add(job)
  if (q.frame !== null) return
  const queue = q
  queue.frame = scheduler.requestAnimationFrame(() => {
    queue.frame = null
    const jobs = [...queue.jobs]
    queue.jobs.clear()
    const writes = jobs.map((read) => read())
    for (const write of writes) write?.()
  })
}

function dequeue(doc: Document, job: Job): void {
  const q = queues.get(doc)
  if (!q) return
  q.jobs.delete(job)
  if (q.jobs.size === 0 && q.frame !== null) {
    q.scheduler.cancelAnimationFrame(q.frame)
    q.frame = null
  }
}

interface Measured {
  readonly overflow: AxisFlags
  readonly edges: EdgeFlags
  readonly tabbable: boolean
}

export function domScrollMetrics(env: Env): ScrollMetricsCapability {
  return {
    track(root, send, options) {
      const ids = scrollAreaIds(root)
      const byId = (id: string) => env.dom.getById(id)
      const viewport = () => byId(ids.viewport)
      const node = env.dom.getRootNode()
      const doc = "body" in node ? node : node.ownerDocument
      injectStyle(doc, "scroll-area", SCROLL_AREA_RULE, env)

      let last: Measured | null = null
      let lastPos = { x: 0, y: 0 }
      // A wheel, touch, pointer or key on the Viewport makes the next scrolls a user's.
      let userUntil = 0
      let userTimer: unknown = null
      /** Cleared 100 ms after the last input or scroll that followed it. */
      const settleUser = () => {
        if (userTimer !== null) env.scheduler.clearTimeout(userTimer)
        userTimer = env.scheduler.setTimeout(() => {
          userUntil = 0
          userTimer = null
        }, 100)
      }
      const markUser = () => {
        userUntil = 1
        settleUser()
      }
      const ranges = (vp: HTMLElement, style: CSSStyleDeclaration) => ({
        x: range(vp, "x", style),
        y: range(vp, "y", style),
      })

      // ---- measure: reads, then (returned) writes ----
      const measure: Job = () => {
        const vp = viewport()
        if (!vp) return null
        const view = vp.ownerDocument.defaultView
        const style = view?.getComputedStyle(vp)
        if (!style) return null
        // Reads.
        const r = ranges(vp, style)
        const overflow = {
          x: vp.scrollWidth > vp.clientWidth && scrolls(style.overflowX),
          y: vp.scrollHeight > vp.clientHeight && scrolls(style.overflowY),
        }
        const rtl = style.direction === "rtl"
        const left = r.x.pos - r.x.min
        const right = r.x.max - left
        const top = r.y.pos - r.y.min
        const bottom = r.y.max - top
        const hidden = {
          xStart: overflow.x ? Math.max(0, rtl ? right : left) : 0,
          xEnd: overflow.x ? Math.max(0, rtl ? left : right) : 0,
          yStart: overflow.y ? Math.max(0, top) : 0,
          yEnd: overflow.y ? Math.max(0, bottom) : 0,
        }
        const thumbs = (["x", "y"] as const).map((axis) => {
          const bar = byId(ids.scrollbar(axis))
          const thumb = byId(ids.thumb(axis))
          if (!bar || !thumb) return null
          const barStyle = view?.getComputedStyle(bar)
          const thumbStyle = view?.getComputedStyle(thumb)
          const vertical = axis === "y"
          const inner = vertical
            ? bar.clientHeight - px(barStyle?.paddingTop ?? "") - px(barStyle?.paddingBottom ?? "")
            : bar.clientWidth - px(barStyle?.paddingLeft ?? "") - px(barStyle?.paddingRight ?? "")
          const client = vertical ? vp.clientHeight : vp.clientWidth
          const total = vertical ? vp.scrollHeight : vp.scrollWidth
          const size = total > 0 ? Math.max(0, (inner * client) / total) : 0
          const minSize = px((vertical ? thumbStyle?.minHeight : thumbStyle?.minWidth) ?? "")
          const rendered = Math.min(inner, Math.max(size, minSize))
          const offset = Math.max(0, physicalFraction(r[axis]) * (inner - rendered))
          return { axis, thumb, bar, size, offset }
        })
        const barX = byId(ids.scrollbar("x"))
        const barY = byId(ids.scrollbar("y"))
        // The corner exists only while both bars are shown (a hidden bar reserves nothing).
        const shown = (bar: HTMLElement | null) => bar?.getAttribute("data-state") === "visible"
        const both = overflow.x && overflow.y && shown(barX) && shown(barY)
        const cornerW = both && barY ? barY.offsetWidth : 0
        const cornerH = both && barX ? barX.offsetHeight : 0
        const content = byId(ids.content)
        const tabbable = content ? tabbables(content).length > 0 : false
        const rootEl = byId(ids.root)
        return () => write(vp, rootEl, thumbs, hidden, cornerW, cornerH, overflow, tabbable)
      }
      /** Sets an inline custom property only when it changes (no mutation, no re-measure). */
      const put = (el: HTMLElement | null, name: string, value: string) => {
        if (el && el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value)
      }
      const write = (
        vp: HTMLElement,
        rootEl: HTMLElement | null,
        thumbs: readonly ({
          axis: ScrollAxis
          thumb: HTMLElement
          bar: HTMLElement
          size: number
          offset: number
        } | null)[],
        hidden: Readonly<Record<"xStart" | "xEnd" | "yStart" | "yEnd", number>>,
        cornerW: number,
        cornerH: number,
        overflow: AxisFlags,
        tabbable: boolean,
      ) => {
        for (const t of thumbs) {
          if (!t) continue
          put(t.thumb, "--rind-scroll-area-thumb-size", `${t.size}px`)
          t.thumb.style.transform =
            t.axis === "y" ? `translate3d(0, ${t.offset}px, 0)` : `translate3d(${t.offset}px, 0, 0)`
          bindWheel(t.axis, t.bar)
        }
        for (const [k, v] of Object.entries(hidden)) {
          const name = k.replace(/([A-Z])/, "-$1").toLowerCase()
          put(vp, `--rind-scroll-area-overflow-${name}`, `${v}px`)
        }
        put(rootEl, "--rind-scroll-area-corner-width", `${cornerW}px`)
        put(rootEl, "--rind-scroll-area-corner-height", `${cornerH}px`)
        // Discrete facts, only when they change.
        const edges = {
          xStart: hidden.xStart > 0.5,
          xEnd: hidden.xEnd > 0.5,
          yStart: hidden.yStart > 0.5,
          yEnd: hidden.yEnd > 0.5,
        }
        const next = { overflow, edges, tabbable }
        if (!last || JSON.stringify(last) !== JSON.stringify(next)) {
          last = next
          send({ type: "METRICS", ...next })
        }
      }
      const schedule = () => {
        if (doc) enqueue(doc, env.scheduler, measure)
      }

      // ---- wheels over the scrollbars (non-passive, on each scrollbar only) ----
      const wheelBound = new Map<ScrollAxis, { el: HTMLElement; off: () => void }>()
      function bindWheel(axis: ScrollAxis, el: HTMLElement) {
        const bound = wheelBound.get(axis)
        if (bound?.el === el) return
        bound?.off()
        const onWheel = (e: WheelEvent) => {
          if (e.ctrlKey) return
          const vp = viewport()
          const style = vp?.ownerDocument.defaultView?.getComputedStyle(vp)
          if (!vp || !style) return
          const unit =
            e.deltaMode === 1
              ? 16
              : e.deltaMode === 2
                ? axis === "y"
                  ? vp.clientHeight
                  : vp.clientWidth
                : 1
          const raw = axis === "y" ? e.deltaY : e.deltaX || e.deltaY
          const delta = raw * unit
          if (delta === 0) return
          const r = range(vp, axis, style)
          const to = wheelTarget(r, delta)
          if (to !== r.pos) {
            e.preventDefault()
            markUser()
            if (axis === "y") vp.scrollTop = to
            else vp.scrollLeft = to
            return
          }
          const behaviour = axis === "y" ? style.overscrollBehaviorY : style.overscrollBehaviorX
          if (behaviour === "contain" || behaviour === "none") e.preventDefault()
        }
        el.addEventListener("wheel", onWheel, { passive: false })
        wheelBound.set(axis, { el, off: () => el.removeEventListener("wheel", onWheel) })
      }

      // ---- drags and track presses (delegated from the Root, own instance only) ----
      const session = pointerDragSession()
      let restoreSnap: (() => void) | null = null
      let stopDrag: (() => void) | null = null
      const own = (el: Element | null, part: string) => {
        const hit = el?.closest(`[data-scope="scroll-area"][data-part="${part}"]`)
        return hit && hit.getAttribute("data-instance") === root ? (hit as HTMLElement) : null
      }
      const scrollTo = (vp: HTMLElement, axis: ScrollAxis, physical: number) => {
        const style = vp.ownerDocument.defaultView?.getComputedStyle(vp)
        if (!style) return
        const r = range(vp, axis, style)
        const to = r.min + Math.min(1, Math.max(0, physical)) * r.max
        if (axis === "y") vp.scrollTop = to
        else vp.scrollLeft = to
      }
      const startDragOn = (
        vp: HTMLElement,
        axis: ScrollAxis,
        bar: HTMLElement,
        e: PointerEvent,
        anchor: number | undefined,
      ) => {
        const style = vp.ownerDocument.defaultView?.getComputedStyle(vp)
        const rtl = style?.direction === "rtl"
        const dragAxis = {
          axis: axis === "y" ? ("vertical" as const) : ("horizontal" as const),
          dir: rtl ? ("rtl" as const) : ("ltr" as const),
          inset: byId(ids.thumb(axis)),
          anchor,
        }
        // pointer-drag reports a logical fraction: from the bottom (vertical), from the
        // inline start (horizontal); the scroll range is physical (from top / left).
        const toPhysical = (f: number) => (axis === "y" || rtl ? 1 - f : f)
        const first = session.press(bar, e, dragAxis)
        if (anchor === undefined && first !== null) scrollTo(vp, axis, toPhysical(first))
        const snap = vp.style.scrollSnapType
        vp.style.scrollSnapType = "none"
        restoreSnap = () => {
          vp.style.scrollSnapType = snap
          restoreSnap = null
        }
        send({ type: "DRAG.START", axis })
        stopDrag = session.track((m) => {
          if (m.type === "move") return scrollTo(vp, axis, toPhysical(m.fraction))
          restoreSnap?.()
          stopDrag = null
          send({ type: m.type === "up" ? "DRAG.END" : "DRAG.CANCEL" })
        })
      }
      const onPointerDown = (e: PointerEvent) => {
        const target = e.target as Element | null
        const vp = viewport()
        if (!vp) return
        if (target && vp.contains(target)) return markUser()
        const bar = own(target, "scrollbar")
        if (!bar || session.active) return
        const axis: ScrollAxis = bar.getAttribute("data-orientation") === "horizontal" ? "x" : "y"
        const style = vp.ownerDocument.defaultView?.getComputedStyle(vp)
        if (!style) return
        const thumb = own(target, "thumb")
        if (thumb) {
          if (!isDragPress(e)) return
          const rtl = style.direction === "rtl"
          const phys = physicalFraction(range(vp, axis, style))
          markUser()
          return startDragOn(vp, axis, bar, e, axis === "y" || rtl ? 1 - phys : phys)
        }
        // The track: mouse and pen only (a finger on it pans the page).
        if (e.pointerType === "touch" || e.button !== 0) return
        markUser()
        if (options().trackPress === "jump") return startDragOn(vp, axis, bar, e, undefined)
        const thumbEl = byId(ids.thumb(axis))
        const box = thumbEl?.getBoundingClientRect()
        const before = box ? (axis === "y" ? e.clientY < box.top : e.clientX < box.left) : false
        const page = axis === "y" ? vp.clientHeight : vp.clientWidth
        const r = range(vp, axis, style)
        const to = Math.min(r.min + r.max, Math.max(r.min, r.pos + (before ? -page : page)))
        if (axis === "y") vp.scrollTop = to
        else vp.scrollLeft = to
      }
      const onUserInput = () => markUser()
      const onScroll = () => {
        const vp = viewport()
        if (!vp) return
        const pos = { x: vp.scrollLeft, y: vp.scrollTop }
        const axis =
          pos.x !== lastPos.x && pos.y !== lastPos.y ? "both" : pos.x !== lastPos.x ? "x" : "y"
        lastPos = pos
        const user = userUntil > 0 || env.modality?.modality() === "touch" || session.active
        if (user && !session.active) send({ type: "SCROLL", axis, user: true })
        if (userUntil > 0) settleUser()
        schedule()
      }

      // ---- observers ----
      const view = doc?.defaultView
      const resize = view?.ResizeObserver ? new view.ResizeObserver(schedule) : null
      // The Content's children, each observed once; a removed child is unobserved.
      const observed = new Set<Element>()
      const observeChildren = () => {
        const content = byId(ids.content)
        if (!resize || !content) return
        const now = new Set(Array.from(content.children))
        for (const child of observed) {
          if (now.has(child)) continue
          resize.unobserve(child)
          observed.delete(child)
        }
        for (const child of now) {
          if (observed.has(child)) continue
          resize.observe(child)
          observed.add(child)
        }
      }
      const mutation = view?.MutationObserver
        ? new view.MutationObserver(() => {
            observeChildren()
            schedule()
          })
        : null
      // Direction and flex direction are read at each measure: re-measure when they may have
      // changed (a `dir` anywhere, the Viewport's style or class), and when a Scrollbar shows or
      // hides (the corner follows visibility). Our own writes change no observed attribute.
      const layout = view?.MutationObserver ? new view.MutationObserver(() => schedule()) : null

      // Parts mount with the Root's commit; bind after it.
      let bound: { vp: HTMLElement; rootEl: HTMLElement | null } | null = null
      const bind = () => {
        const vp = viewport()
        if (!vp) return
        const rootEl = byId(ids.root)
        bound = { vp, rootEl }
        lastPos = { x: vp.scrollLeft, y: vp.scrollTop }
        vp.addEventListener("scroll", onScroll, { passive: true })
        for (const type of ["wheel", "touchstart", "keydown"] as const) {
          vp.addEventListener(type, onUserInput, { passive: true })
        }
        rootEl?.addEventListener("pointerdown", onPointerDown)
        resize?.observe(vp)
        const content = byId(ids.content)
        if (content) {
          resize?.observe(content)
          observeChildren()
          mutation?.observe(content, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["tabindex", "disabled", "hidden", "inert", "contenteditable", "href"],
          })
        }
        if (layout) {
          if (doc?.documentElement) {
            layout.observe(doc.documentElement, { subtree: true, attributeFilter: ["dir"] })
          }
          layout.observe(vp, { attributeFilter: ["style", "class"] })
          for (const axis of ["x", "y"] as const) {
            const bar = byId(ids.scrollbar(axis))
            if (bar) layout.observe(bar, { attributeFilter: ["data-state"] })
          }
        }
        schedule()
      }
      const bindFrame = env.scheduler.requestAnimationFrame(bind)

      return {
        measure: schedule,
        stop() {
          env.scheduler.cancelAnimationFrame(bindFrame)
          if (doc) dequeue(doc, measure)
          if (userTimer !== null) env.scheduler.clearTimeout(userTimer)
          stopDrag?.()
          restoreSnap?.()
          resize?.disconnect()
          mutation?.disconnect()
          layout?.disconnect()
          for (const { off } of wheelBound.values()) off()
          wheelBound.clear()
          if (bound) {
            const { vp, rootEl } = bound
            vp.removeEventListener("scroll", onScroll)
            for (const type of ["wheel", "touchstart", "keydown"] as const) {
              vp.removeEventListener(type, onUserInput)
            }
            rootEl?.removeEventListener("pointerdown", onPointerDown)
            bound = null
          }
        },
      }
    },
  }
}

/** The axis's scroll range, normalised for reversed axes (RTL, row-reverse, column-reverse). */
function range(vp: HTMLElement, axis: ScrollAxis, style: CSSStyleDeclaration): AxisRange {
  const max = Math.max(
    0,
    axis === "x" ? vp.scrollWidth - vp.clientWidth : vp.scrollHeight - vp.clientHeight,
  )
  const reversed = isReversed(axis, style.direction, style.flexDirection)
  return { pos: axis === "x" ? vp.scrollLeft : vp.scrollTop, min: reversed ? -max : 0, max }
}
