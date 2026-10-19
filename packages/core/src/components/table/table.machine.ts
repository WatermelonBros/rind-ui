// Table (design §2): one state. The sort is a controllable value written through one path (as
// Rating's): uncontrolled it changes and is announced; controlled the proposal waits for the
// prop and is announced only when it arrives with that value. The scroll container's tab stop
// follows the Scroll Area rule from discrete measurements a DOM capability sends.

import type { Modality } from "../../contract/env"
import type { AnnouncerEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import type { AxisFlags, EdgeFlags } from "../scroll-area/scroll-area.machine"
import type { TableMessages } from "./table.messages"
import {
  nextSort,
  type SortDescriptor,
  type SortDirection,
  sameSort,
  type TableSortValue,
} from "./table.sort"

export type TableEvent =
  /** A press on a column's SortTrigger: its id, its text and its first direction. */
  | {
      readonly type: "SORT"
      readonly column: string
      readonly name: string
      readonly firstDirection: SortDirection
      readonly modality: Modality
    }
  /** The controlled `sort` prop changed (onProps). */
  | { readonly type: "SORT.SYNCED" }
  | {
      readonly type: "MEASURED"
      readonly overflow: AxisFlags
      readonly edges: EdgeFlags
      readonly tabbable: boolean
    }
  | { readonly type: "ROOT.FOCUS" | "ROOT.BLUR" }
  /** `rowCount` or `rowRange` changed (onProps): announced after a quiet period. */
  | { readonly type: "ROWS.CHANGED" }
  /** A RowTrigger: open or close the row's details. */
  | { readonly type: "ROW.TOGGLE"; readonly row: string }

/** What the measuring effect reaches the DOM through (injected; faked in tests). */
export interface TableMetricsCapability {
  /** Measures the Root `root` (the instance id) now and on every change; returns the stop. */
  track(root: string, send: (event: TableEvent) => void): () => void
}
export interface TableMetricsEnv {
  /** Absent where there is no DOM (server, a model's oracle): nothing is measured. */
  readonly tableMetrics?: TableMetricsCapability | undefined
}

export interface TableProps {
  /** The instance id: the announcement key and the measured Root. */
  readonly root: string
  readonly messages: TableMessages
  readonly lang?: string | undefined
  /** Controlled when given; `{ value: null }` is controlled and unsorted. */
  readonly sort?: TableSortValue | undefined
  readonly defaultSort?: TableSortValue | undefined
  readonly onSortChange?:
    | ((sort: TableSortValue, details: ChangeDetails<TableEvent>) => void)
    | undefined
  /** A press on the sorted column at the opposite of its first direction clears the sort. */
  readonly allowUnsorted?: boolean | undefined
  /** Column ids pinned at the inline start and end edges (controllable). */
  readonly pinnedColumns?: PinnedColumns | undefined
  readonly defaultPinnedColumns?: PinnedColumns | undefined
  readonly onPinnedColumnsChange?:
    | ((pinned: PinnedColumns, details: ChangeDetails<TableEvent>) => void)
    | undefined
  /** Row ids whose details are open (controllable). */
  readonly expandedRows?: readonly string[] | undefined
  readonly defaultExpandedRows?: readonly string[] | undefined
  readonly onExpandedRowsChange?:
    | ((rows: readonly string[], details: ChangeDetails<TableEvent>) => void)
    | undefined
  /** Several rows open at once (default); `false`: opening one closes the others. */
  readonly multiple?: boolean | undefined
  /** The rows the consumer shows (after filters): announced when it changes. */
  readonly rowCount?: number | undefined
  /** With pagination: the rows shown of the total, announced instead of the count. */
  readonly rowRange?: RowRange | undefined
}

export interface PinnedColumns {
  readonly start: readonly string[]
  readonly end: readonly string[]
}

export interface RowRange {
  readonly from: number
  readonly to: number
  readonly total: number
}

const samePinned = (a: PinnedColumns, b: PinnedColumns) =>
  a.start.length === b.start.length &&
  a.end.length === b.end.length &&
  a.start.every((c, i) => b.start[i] === c) &&
  a.end.every((c, i) => b.end[i] === c)
const sameRange = (a: RowRange | undefined, b: RowRange | undefined) =>
  a === b || (!!a && !!b && a.from === b.from && a.to === b.to && a.total === b.total)

/** The quiet period before a changed row count is announced (typing announces once). */
export const ROW_COUNT_QUIET_MS = 400

export interface TableContext {
  /** A controlled proposal not yet answered, with the column's text for the announcement. */
  readonly pending: { readonly sort: SortDescriptor | null; readonly name: string } | null
  readonly measured: boolean
  readonly overflow: AxisFlags
  readonly edges: EdgeFlags
  readonly tabbableContent: boolean
  readonly focused: boolean
  /** Latched: kept while the Root has focus, re-evaluated on blur (mui/base-ui#4205). */
  readonly tabStop: boolean
}

type Types = {
  props: TableProps
  events: TableEvent
  env: AnnouncerEnv & SchedulerEnv & TableMetricsEnv
  context: TableContext
  values: "sort" | "pinnedColumns" | "expandedRows"
}
type Args = ActionArgs<Types>

const sameBox = (a: TableSortValue, b: TableSortValue) => sameSort(a.value, b.value)

/** The tab-stop rule (spec "Scroll Container"). */
export const tableTabStopRule = (
  c: Pick<TableContext, "measured" | "overflow" | "tabbableContent">,
) => c.measured && (c.overflow.x || c.overflow.y) && !c.tabbableContent

const controlled = (props: TableProps) => props.sort !== undefined
/** The latest sort: an unanswered controlled proposal, else the value. */
const latest = (args: Args) =>
  args.context.pending ? args.context.pending.sort : args.values.sort.value

function announce(args: Args, sort: SortDescriptor | null, name: string) {
  const { env, props } = args
  env.announcer.announce({
    message: sort ? props.messages.sorted(name, sort.direction) : props.messages.unsorted(name),
    priority: "polite",
    key: `table-${props.root}`,
    ...(props.lang === undefined ? {} : { lang: props.lang }),
  })
}

export const tableMachine = setup({
  types: type<Types>(),
  actions: {
    /** The one write: a press proposes the next sort. */
    sortPress: (args) => {
      const { event, props, set } = args
      if (event.type !== "SORT") return
      const now = latest(args)
      const next = nextSort(now, event.column, event.firstDirection, props.allowUnsorted === true)
      if (sameSort(now, next)) return
      set("sort", { value: next })
      if (controlled(props)) {
        set("pending", { sort: next, name: event.name })
        return
      }
      // Refused through details.cancel(): nothing changed, nothing is said.
      if (sameSort(args.values.sort.value, next)) announce(args, next, event.name)
    },
    /** The controlled sort arrived: announced only when it is the user's proposal. */
    applySynced: (args) => {
      const pending = args.context.pending
      args.set("pending", null)
      if (pending && sameSort(pending.sort, args.values.sort.value)) {
        announce(args, pending.sort, pending.name)
      }
    },
    forgetPending: ({ set }) => set("pending", null),
    measured: ({ context, event, set }) => {
      if (event.type !== "MEASURED") return
      const next = { measured: true, overflow: event.overflow, tabbableContent: event.tabbable }
      set("measured", true)
      set("overflow", event.overflow)
      set("edges", event.edges)
      set("tabbableContent", event.tabbable)
      set("tabStop", tableTabStopRule(next) || (context.focused && context.tabStop))
    },
    toggleRow: ({ event, props, values, set }) => {
      if (event.type !== "ROW.TOGGLE") return
      const open = values.expandedRows
      const next = open.includes(event.row)
        ? open.filter((r) => r !== event.row)
        : props.multiple === false
          ? [event.row]
          : [...open, event.row]
      set("expandedRows", next)
    },
    announceRows: ({ env, props }) => {
      const message = props.rowRange
        ? props.messages.rowRange(props.rowRange.from, props.rowRange.to, props.rowRange.total)
        : props.rowCount !== undefined
          ? props.messages.rowCount(props.rowCount)
          : null
      if (message === null) return
      env.announcer.announce({
        message,
        priority: "polite",
        key: `table-rows-${props.root}`,
        ...(props.lang === undefined ? {} : { lang: props.lang }),
      })
    },
    rootFocus: ({ set }) => set("focused", true),
    rootBlur: ({ context, set }) => {
      set("focused", false)
      set("tabStop", tableTabStopRule(context))
    },
  },
  delays: {
    quiet: () => ROW_COUNT_QUIET_MS,
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
    /** Overflow, edges, tabbable content and the head's size, for the service's life. */
    track: ({ env, props, send }) => env.tableMetrics?.track(props.root, send),
  },
}).machine({
  id: "table",
  initial: "idle",
  context: () => ({
    pending: null,
    measured: false,
    overflow: { x: false, y: false },
    edges: { xStart: false, xEnd: false, yStart: false, yEnd: false },
    tabbableContent: false,
    focused: false,
    tabStop: false,
  }),
  // By content: the React Root wraps the descriptor in a new box per render.
  values: {
    sort: { fallback: { value: null }, equal: sameBox },
    pinnedColumns: { fallback: { start: [], end: [] }, equal: samePinned },
    expandedRows: {
      fallback: [],
      equal: (a, b) => a.length === b.length && a.every((r, i) => b[i] === r),
    },
  },
  onProps: {
    sort: { event: "SORT.SYNCED", equal: (a, b) => a === b || (!!a && !!b && sameBox(a, b)) },
    rowCount: "ROWS.CHANGED",
    rowRange: { event: "ROWS.CHANGED", equal: sameRange },
  },
  effects: ["prepareAnnouncer", "track"],
  on: {
    SORT: { actions: ["sortPress"] },
    "SORT.SYNCED": { actions: ["applySynced"] },
    $reverted: { actions: ["forgetPending"] },
    MEASURED: { actions: ["measured"] },
    "ROOT.FOCUS": { actions: ["rootFocus"] },
    "ROOT.BLUR": { actions: ["rootBlur"] },
    "ROW.TOGGLE": { actions: ["toggleRow"] },
  },
  states: {
    idle: { on: { "ROWS.CHANGED": "counting" } },
    // A change restarts the quiet period; the last count is announced once.
    counting: {
      after: { quiet: { target: "idle", actions: ["announceRows"] } },
      on: { "ROWS.CHANGED": { target: "counting", reenter: true } },
    },
  },
})

export type TableMachine = typeof tableMachine
