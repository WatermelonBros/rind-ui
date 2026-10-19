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

type Side = "start" | "end"

/** The cells of a row by visual column (a colspan covers several columns). */
function cellsByColumn(row: HTMLTableRowElement): (HTMLTableCellElement | undefined)[] {
  const out: (HTMLTableCellElement | undefined)[] = []
  for (const cell of Array.from(row.cells)) {
    for (let i = 0; i < (cell.colSpan || 1); i++) out.push(i === 0 ? cell : undefined)
  }
  return out
}

/**
 * Pinned columns (table-columns-and-toolbar design §1): the last head row's headers carry
 * `data-pinned` (connect); every cell at those visual columns gets the same flag and its offset
 * at its edge; the innermost at each edge gets `data-pinned-edge`. Returns the cells it marked.
 */
function pin(root: HTMLElement, marked: Set<HTMLElement>): { start: number; end: number } {
  const table = root.querySelector<HTMLTableElement>(":scope > table")
  const leaf = table?.tHead?.rows[table.tHead.rows.length - 1]
  const width = { start: 0, end: 0 }
  const columns = new Map<number, { side: Side; offset: number; edge: boolean }>()
  if (table && leaf) {
    const heads = cellsByColumn(leaf)
    const pinned = (side: Side) =>
      heads
        .map((h, index) => ({ h, index }))
        .filter((c) => c.h?.getAttribute("data-pinned") === side)
    for (const side of ["start", "end"] as const) {
      const list = side === "start" ? pinned(side) : pinned(side).reverse()
      let offset = 0
      list.forEach((c, i) => {
        columns.set(c.index, { side, offset, edge: i === list.length - 1 })
        offset += c.h?.offsetWidth ?? 0
      })
      width[side] = offset
    }
  }
  const now = new Set<HTMLElement>()
  if (table && columns.size > 0) {
    for (const row of Array.from(table.rows)) {
      // The leaf headers are connect's: only their offset is written here.
      cellsByColumn(row).forEach((cell, index) => {
        const c = columns.get(index)
        if (!cell || !c) return
        if (row !== leaf) cell.setAttribute("data-pinned", c.side)
        if (c.edge) cell.setAttribute("data-pinned-edge", "")
        else cell.removeAttribute("data-pinned-edge")
        cell.style.setProperty("--rind-table-pin-offset", `${c.offset}px`)
        now.add(cell)
      })
    }
  }
  for (const cell of marked) {
    if (now.has(cell)) continue
    if (cell.closest("thead")?.querySelector("tr:last-child") !== cell.parentElement) {
      cell.removeAttribute("data-pinned")
    }
    cell.removeAttribute("data-pinned-edge")
    cell.style.removeProperty("--rind-table-pin-offset")
  }
  marked.clear()
  for (const cell of now) marked.add(cell)
  return width
}

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
      const marked = new Set<HTMLElement>()
      const run = () => {
        frame = null
        const pinned = pin(root, marked)
        root.style.setProperty("--rind-table-pinned-start-width", `${pinned.start}px`)
        root.style.setProperty("--rind-table-pinned-end-width", `${pinned.end}px`)
        // The visible width: a details row's content stays inside it while the table scrolls.
        root.style.setProperty("--rind-table-viewport-width", `${root.clientWidth}px`)
        // Our own writes are not changes to react to.
        mutations?.takeRecords()
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
        // Pinned columns' widths set the offsets of the ones after them.
        for (const h of Array.from(head?.querySelectorAll("[data-pinned]") ?? []))
          resize?.observe(h)
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
        attributeFilter: [
          "tabindex",
          "disabled",
          "href",
          "contenteditable",
          "hidden",
          "inert",
          "data-pinned",
        ],
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
        root.style.removeProperty("--rind-table-pinned-start-width")
        root.style.removeProperty("--rind-table-pinned-end-width")
        root.style.removeProperty("--rind-table-viewport-width")
        for (const cell of marked) {
          cell.removeAttribute("data-pinned-edge")
          cell.style.removeProperty("--rind-table-pin-offset")
        }
      }
    },
  }
}
