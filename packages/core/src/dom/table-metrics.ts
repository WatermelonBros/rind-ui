// table-metrics (add-table design §2): the only module that touches a Table's layout. It
// measures the Root (the scroll container): overflow per scrollable axis, the logical inline
// edges with hidden content, whether anything inside is tabbable; and writes the Head's height
// and the first header cell's width as CSS variables, so a sticky head and column never hide
// focus (scroll padding). It sends the machine only discrete facts, and only when they change.

import type { TableEvent, TableMetricsCapability } from "../components/table/table.machine"
import type { DomEnv, SchedulerEnv } from "../env/capabilities"
import { hasTabbable } from "./tabbable-content"

const scrolls = (v: string | undefined) => v === "auto" || v === "scroll"

type Measured = Extract<TableEvent, { type: "MEASURED" }>

function measure(root: HTMLElement): Measured {
  const style = root.ownerDocument.defaultView?.getComputedStyle(root)
  const x = root.scrollWidth > root.clientWidth + 1 && scrolls(style?.overflowX)
  const y = root.scrollHeight > root.clientHeight + 1 && scrolls(style?.overflowY)
  // RTL scrolls from 0 to negative (every current engine): the magnitude is the logical offset.
  const max = root.scrollWidth - root.clientWidth
  const at = Math.abs(root.scrollLeft)
  const top = root.scrollTop
  const maxY = root.scrollHeight - root.clientHeight
  return {
    type: "MEASURED",
    overflow: { x, y },
    edges: {
      xStart: x && at > 1,
      xEnd: x && at < max - 1,
      yStart: y && top > 1,
      yEnd: y && top < maxY - 1,
    },
    tabbable: hasTabbable(root),
  }
}

const same = (a: Measured | null, b: Measured) =>
  a !== null &&
  a.tabbable === b.tabbable &&
  a.overflow.x === b.overflow.x &&
  a.overflow.y === b.overflow.y &&
  a.edges.xStart === b.edges.xStart &&
  a.edges.xEnd === b.edges.xEnd &&
  a.edges.yStart === b.edges.yStart &&
  a.edges.yEnd === b.edges.yEnd

export function domTableMetrics(env: DomEnv & SchedulerEnv): TableMetricsCapability {
  return {
    track(instance, send) {
      const node = env.dom.getRootNode()
      const root = node.querySelector<HTMLElement>(
        `[data-scope="table"][data-part="root"][data-instance="${CSS.escape(instance)}"]`,
      )
      const win = root?.ownerDocument.defaultView
      if (!root || !win) return () => {}
      let last: Measured | null = null
      let frame: unknown = null
      const run = () => {
        frame = null
        const head = root.querySelector<HTMLElement>(":scope > table > thead")
        const first = head?.querySelector<HTMLElement>("tr > th")
        root.style.setProperty("--rind-table-head-height", `${head?.offsetHeight ?? 0}px`)
        root.style.setProperty("--rind-table-first-column-width", `${first?.offsetWidth ?? 0}px`)
        const now = measure(root)
        if (same(last, now)) return
        last = now
        send(now)
      }
      const schedule = () => {
        if (frame === null) frame = env.scheduler.requestAnimationFrame(run)
      }
      const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null
      const observeLayout = () => {
        resize?.disconnect()
        resize?.observe(root)
        const table = root.querySelector(":scope > table")
        if (table) resize?.observe(table)
        const head = table?.querySelector(":scope > thead")
        if (head) resize?.observe(head)
        const first = head?.querySelector("tr > th")
        if (first) resize?.observe(first)
      }
      // Rows, cells and controls come and go: the layout to observe and the tabbable answer.
      const mutations = win.MutationObserver
        ? new win.MutationObserver(() => {
            observeLayout()
            schedule()
          })
        : null
      mutations?.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["tabindex", "disabled", "href", "contenteditable", "hidden", "inert"],
      })
      observeLayout()
      root.addEventListener("scroll", schedule, { passive: true })
      run()
      return () => {
        if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
        resize?.disconnect()
        mutations?.disconnect()
        root.removeEventListener("scroll", schedule)
        root.style.removeProperty("--rind-table-head-height")
        root.style.removeProperty("--rind-table-first-column-width")
      }
    },
  }
}
