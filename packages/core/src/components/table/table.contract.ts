import { contract, type Invariant } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import { tableMachine } from "./table.machine"
import type { SortDirection } from "./table.sort"

type P =
  | "root"
  | "table"
  | "caption"
  | "head"
  | "body"
  | "foot"
  | "row"
  | "column-header"
  | "row-header"
  | "cell"
  | "sort-trigger"
  | "sort-indicator"
  | "empty"
  | "frame"
  | "header"
  | "footer"
  | "expand-trigger"
  | "filter-trigger"
  | "filter-indicator"
  | "row-trigger"
  | "row-details"
type E = Env<P>

const TABLE_TAGS = new Set(["table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td"])

/** The column headers of the last head row: one per leaf column. */
async function leafHeaders(env: E): Promise<readonly Part[]> {
  const rows = await env.part("head").scoped("table", "row").all()
  const last = rows.at(-1)
  return last ? last.scoped("table", "column-header").all() : []
}

async function header(env: E, column: string): Promise<Part> {
  for (const h of await env.part("column-header").all()) {
    if ((await h.accessibleName()) === column) return h
  }
  throw new Error(`table: no column "${column}"`)
}

const filterTrigger = async (env: E, column: string) =>
  (await header(env, column)).scoped("table", "filter-trigger")

/** The trigger of the body row whose RowHeader reads `row`. */
async function rowTrigger(env: E, row: string): Promise<Part> {
  for (const r of await env.part("body").scoped("table", "row").all()) {
    const header = r.scoped("table", "row-header")
    if ((await header.exists()) && (await header.accessibleName()) === row) {
      return r.scoped("table", "row-trigger")
    }
  }
  throw new Error(`table: no row "${row}"`)
}

const isExpanded = async (env: E) =>
  (await env.part("frame").exists()) && (await env.part("frame").attr("data-expanded")) !== null

async function trigger(env: E, column: string): Promise<Part> {
  for (const h of await env.part("column-header").all()) {
    if ((await h.accessibleName()) === column) return h.scoped("table", "sort-trigger")
  }
  throw new Error(`table: no sortable column "${column}"`)
}

const sort = async (env: E): Promise<{ column: string; direction: SortDirection } | null> => {
  for (const h of await env.part("column-header").all()) {
    const direction = await h.attr("aria-sort")
    if (direction === "ascending" || direction === "descending") {
      return { column: await h.accessibleName(), direction }
    }
  }
  return null
}

/**
 * Table invariants (spec "Table Invariants"): one header at most carries `aria-sort`; every
 * sortable header holds one button named by its text; no table element carries a `role`; the
 * Root, while it is a tab stop, has a name.
 */
const invariants: readonly Invariant<P>[] = [
  {
    name: "table-one-aria-sort",
    check: async ({ env }) => {
      let n = 0
      for (const h of await env.part("column-header").all()) {
        if ((await h.attr("aria-sort")) !== null) n++
      }
      return n > 1 ? `${n} headers carry aria-sort` : undefined
    },
  },
  {
    name: "table-sort-trigger-named-by-header",
    check: async ({ env }) => {
      for (const h of await env.part("column-header").all()) {
        if ((await h.attr("data-sortable")) === null) continue
        const buttons = await h.scoped("table", "sort-trigger").all()
        if (buttons.length !== 1) return `a sortable header holds ${buttons.length} buttons`
        const [name, text] = [await buttons[0]?.accessibleName(), await h.accessibleName()]
        if (name !== text) return `the trigger is named "${name}", its header reads "${text}"`
      }
      return undefined
    },
  },
  {
    name: "table-no-role-on-table-elements",
    check: async ({ env }) => {
      for (const part of ["table", "row", "column-header", "row-header", "cell"] as const) {
        for (const el of await env.part(part).all()) {
          if (TABLE_TAGS.has(await el.tagName()) && (await el.attr("role")) !== null) {
            return `a ${await el.tagName()} carries role="${await el.attr("role")}"`
          }
        }
      }
      return undefined
    },
  },
  {
    name: "table-scroll-stop-named",
    check: async ({ env }) => {
      const root = env.part("root")
      if ((await root.attr("tabindex")) !== "0") return undefined
      if ((await root.attr("role")) !== "group") return "the scroll stop is not a group"
      return (await root.accessibleName()) === "" ? "the scroll stop has no name" : undefined
    },
  },
]

/**
 * Table's contract (spec "Table Contract"): located by role `table` and its name. `sortBy`
 * presses a column's SortTrigger; `focusScroller` tabs to the Root and fails when it is not a
 * tab stop. The model tests map SORT to the story's columns.
 */
export const tableContract = contract("table", {
  machine: tableMachine,
  anatomy: [
    "root",
    "table",
    "caption",
    "head",
    "body",
    "foot",
    "row",
    "column-header",
    "row-header",
    "cell",
    "sort-trigger",
    "sort-indicator",
    "empty",
    "frame",
    "header",
    "footer",
    "expand-trigger",
    "filter-trigger",
    "filter-indicator",
    "row-trigger",
    "row-details",
  ],
  locate: (anchor?: { readonly name: string | RegExp }) =>
    anchor ? { role: "table", name: anchor.name } : { part: "table" },
  actions: {
    sortBy: {
      pointer: async (env, column: string) => (await trigger(env, column)).click(),
      touch: async (env, column: string) => (await trigger(env, column)).tap(),
      keyboard: async (env, column: string) => {
        const t = await trigger(env, column)
        await t.focus()
        await t.press("Enter")
      },
      done: async () => true,
    },
    openFilter: {
      pointer: async (env, column: string) => (await filterTrigger(env, column)).click(),
      keyboard: async (env, column: string) => {
        const t = await filterTrigger(env, column)
        await t.focus()
        await t.press("Enter")
      },
      done: async (env, column: string) =>
        (await (await filterTrigger(env, column)).attr("aria-expanded")) === "true",
    },
    closeFilter: {
      keyboard: async (env) => env.keyboard("Escape"),
      done: async () => true,
    },
    setExpanded: {
      pointer: async (env, on: boolean) => {
        if ((await isExpanded(env)) !== on) await env.part("expand-trigger").click()
      },
      keyboard: async (env, on: boolean) => {
        if ((await isExpanded(env)) === on) return
        if (on) await env.part("expand-trigger").press("Enter")
        else await env.keyboard("Escape")
      },
      done: async (env, on: boolean) => (await isExpanded(env)) === on,
    },
    toggleRow: {
      pointer: async (env, row: string) => (await rowTrigger(env, row)).click(),
      keyboard: async (env, row: string) => {
        const t = await rowTrigger(env, row)
        await t.focus()
        await t.press("Enter")
      },
      done: async () => true,
    },
    focusScroller: {
      keyboard: async (env) => {
        const root = env.part("root")
        if ((await root.attr("tabindex")) !== "0") {
          throw new Error(
            "table: the scroll container is not a tab stop (it fits, or holds controls)",
          )
        }
        await root.focusWithTab()
      },
      done: async (env) => env.part("root").isFocused(),
    },
  },
  queries: {
    name: async (env: E) => env.part("table").accessibleName(),
    columns: async (env: E) => {
      const out: { name: string; sortable: boolean; sort: SortDirection | null }[] = []
      for (const h of await leafHeaders(env)) {
        const s = await h.attr("aria-sort")
        out.push({
          name: await h.accessibleName(),
          sortable: (await h.attr("data-sortable")) !== null,
          sort: s === "ascending" || s === "descending" ? s : null,
        })
      }
      return out
    },
    /** The body's text matrix, row headers included. */
    rows: async (env: E) => {
      const out: string[][] = []
      for (const row of await env.part("body").scoped("table", "row").all()) {
        const cells: string[] = []
        for (const c of await row.withAttr("data-part").all()) {
          const part = await c.attr("data-part")
          if (part === "row-header" || part === "cell") cells.push(await c.text())
        }
        out.push(cells)
      }
      return out
    },
    sort,
    /** Pinned column names at each edge, from the headers. */
    pinned: async (env: E) => {
      const out: { start: string[]; end: string[] } = { start: [], end: [] }
      for (const h of await env.part("column-header").all()) {
        const side = await h.attr("data-pinned")
        if (side === "start" || side === "end") out[side].push(await h.accessibleName())
      }
      return out
    },
    isExpanded,
    /** The RowHeader text of each body row whose details are open. */
    expandedRows: async (env: E) => {
      const out: string[] = []
      for (const r of await env.part("body").scoped("table", "row").all()) {
        if ((await r.attr("data-part")) !== "row" || (await r.attr("data-expanded")) === null)
          continue
        const header = r.scoped("table", "row-header")
        if (await header.exists()) out.push(await header.accessibleName())
      }
      return out
    },
    isFilterActive: async (env: E, column: string) =>
      (await (await filterTrigger(env, column)).attr("data-active")) !== null,
    isScrollStop: async (env: E) => (await env.part("root").attr("tabindex")) === "0",
    isEmpty: async (env: E) => (await env.part("table").attr("data-empty")) !== null,
    isLoading: async (env: E) => (await env.part("table").attr("aria-busy")) === "true",
  },
  states: { idle: {}, counting: {} },
  events: {
    SORT: { skip: "the column is the story's: the model tests map it" },
    "SORT.SYNCED": { skip: "the parent's prop change: the controlled configurations" },
    MEASURED: { skip: "layout: the browser tests" },
    "ROOT.FOCUS": { skip: "a scroll stop needs layout: the browser tests" },
    "ROOT.BLUR": { skip: "a scroll stop needs layout: the browser tests" },
    "$props:sort": { skip: "the parent's prop change: the controlled DOM tests" },
    "$props:pinnedColumns": { skip: "the parent's prop change: the pinned DOM tests" },
    "ROWS.CHANGED": { skip: "the parent's row count: the announcement DOM tests" },
    "$props:rowCount": { skip: "the parent's row count: the announcement DOM tests" },
    "ROW.TOGGLE": { skip: "the row is the story's: the expandable-row DOM tests" },
    "$props:expandedRows": { skip: "the parent's prop change: the expandable-row DOM tests" },
    "$props:rowRange": { skip: "the parent's row range: the announcement DOM tests" },
  },
  traits: [],
  invariants,
})
