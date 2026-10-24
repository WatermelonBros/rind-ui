/** @jsxImportSource solid-js */
// Table parts: wiring only. The machine owns the sort, pinned columns, expanded rows and the
// scroll tab stop; connect every attribute. The Filter parts are a Popover scoped to the table.
import {
  announcerCapability,
  type ChangeDetails,
  domTableMetrics,
  itemId,
  type MessageOverrides,
  type PinnedColumns,
  quirkActive,
  type RowRange,
  type SortDescriptor,
  type SortDirection,
  type TableEvent,
  type TableFrameEvent,
  type TableMessages,
  type TableSortValue,
  tableConnect,
  tableFrameConnect,
  tableFrameIds,
  tableFrameMachine,
  tableMachine,
  tableMessages,
  visibleText,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  children as resolve,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { IconChildren } from "../icons"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import {
  type PopoverContentProps,
  type PopoverRootProps,
  type PopoverTriggerProps,
  ScopedPopoverRoot,
} from "../popover/popover"
import * as Popover from "../popover/popover.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { VisuallyHidden } from "../visually-hidden"

declare module "../provider" {
  interface RindMessageScopes {
    table: TableMessages
  }
}

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** What every part's `render` receives. */
export interface TableRenderState {
  readonly sort: SortDescriptor | null
  readonly scrollStop: boolean
}

type Api = ReturnType<typeof tableConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: TableEvent) => void
  readonly state: TableRenderState
  readonly instance: Accessor<string>
  readonly captionId: Accessor<string>
  readonly registry: PartRegistry<"caption">
  readonly captioned: Accessor<boolean>
  /** The Frame around the Root, when there is one (the Caption names it while expanded). */
  readonly frame: FrameCtx | undefined
  /** Sortable column ids, for the duplicate check. */
  readonly columns: Set<string>
  readonly setEmpty: (delta: 1 | -1) => void
  readonly setTableLabel: (label: string | undefined) => void
}
const TableContext = createContext<Ctx>()
function useTable(part: string): Ctx {
  const ctx = useContext(TableContext)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Root`)
  return ctx
}

interface ColumnCtx {
  readonly id: Accessor<string | undefined>
  readonly firstDirection: Accessor<SortDirection>
  readonly sortable: Accessor<boolean>
  /** The column's text (measured after mount; the id until then). */
  readonly text: Accessor<string>
  /** A Filter registers while mounted. */
  readonly addFilter: () => () => void
}
const ColumnContext = createContext<ColumnCtx>()

/** JSX span attributes may be strings; connect takes numbers. */
const num = (v: string | number | undefined) => (v === undefined ? undefined : Number(v))

const box = (value: SortDescriptor | null): TableSortValue => ({ value })

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<TableRenderState> | undefined
  readonly children?: JSX.Element | ((state: TableRenderState) => JSX.Element)
}

export type TableRootProps = Own<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Controlled sort; `null` is controlled and unsorted. The Table never reorders rows. */
  readonly sort?: SortDescriptor | null | undefined
  readonly defaultSort?: SortDescriptor | null | undefined
  /** A press proposes the next sort; `details.event.column`, `details.cancel()`. */
  readonly onSortChange?:
    | ((sort: SortDescriptor | null, details: ChangeDetails<TableEvent>) => void)
    | undefined
  /** A press on the sorted column at the opposite of its first direction clears the sort. */
  readonly allowUnsorted?: boolean | undefined
  /** `data-sticky-first-column` on the Root (the theme pins the first cell of each row). */
  readonly stickyFirstColumn?: boolean | undefined
  /** Column ids pinned at the inline start and end (controllable). */
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
  /** The rows shown (after filters): announced when it changes. */
  readonly rowCount?: number | undefined
  /** With pagination: the rows shown of the total, announced instead of the count. */
  readonly rowRange?: RowRange | undefined
  readonly messages?: MessageOverrides<TableMessages> | undefined
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string | undefined
}

const sameSort = (a: TableSortValue | undefined, b: TableSortValue | undefined) =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.value?.column === b.value?.column &&
    a.value?.direction === b.value?.direction &&
    (a.value === null) === (b.value === null))

function Root(props: TableRootProps) {
  const [own, rest] = splitProps(props, [
    "sort",
    "defaultSort",
    "onSortChange",
    "allowUnsorted",
    "stickyFirstColumn",
    "pinnedColumns",
    "defaultPinnedColumns",
    "onPinnedColumnsChange",
    "rowCount",
    "rowRange",
    "expandedRows",
    "defaultExpandedRows",
    "onExpandedRowsChange",
    "multiple",
    "messages",
    "locale",
    "render",
    "children",
  ])
  // Inside a Frame the Root shares its instance: every part of the table is one instance.
  const frameCtx = useContext(FrameContext)
  const instance = useRootId(() => rest.id ?? frameCtx?.instance())
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("table", tableMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const registry = usePartRegistry<"caption">({ scope: "table", root: instance() })
  const tableEnv = { ...env, tableMetrics: domTableMetrics(env) }
  // One box per descriptor: the machine compares by content, Solid's memo by identity.
  const controlled = createMemo(
    () => (own.sort === undefined ? undefined : box(own.sort)),
    undefined,
    {
      equals: sameSort,
    },
  )
  const initial = untrack(() => (own.defaultSort === undefined ? undefined : box(own.defaultSort)))
  const { view, send } = useMachine(
    tableMachine,
    () => ({
      root: instance(),
      messages: messages(),
      lang: locale().locale,
      sort: controlled(),
      defaultSort: initial,
      onSortChange: own.onSortChange
        ? (s: TableSortValue, details: ChangeDetails<TableEvent>) =>
            own.onSortChange?.(s.value, details)
        : undefined,
      allowUnsorted: own.allowUnsorted,
      pinnedColumns: own.pinnedColumns,
      defaultPinnedColumns: own.defaultPinnedColumns,
      onPinnedColumnsChange: own.onPinnedColumnsChange,
      rowCount: own.rowCount,
      rowRange: own.rowRange,
      expandedRows: own.expandedRows,
      defaultExpandedRows: own.defaultExpandedRows,
      onExpandedRowsChange: own.onExpandedRowsChange,
      multiple: own.multiple,
    }),
    tableEnv,
  )
  const [mounted, setMounted] = createSignal(false)
  afterMount(() => setMounted(true))
  const [emptyCount, setEmptyCount] = createSignal(0)
  const columns = new Set<string>()
  const [tableLabel, setTableLabel] = createSignal<string | undefined>(undefined)
  const captionId = useRenderedId(registry, "caption")
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const current = () => view().values.sort.value
  const state = reactive<TableRenderState>(() => ({
    sort: current(),
    scrollStop: view().context.tabStop,
  }))
  const api = createMemo(() => {
    const ctx = view().context
    return tableConnect({
      instance: instance(),
      sort: current(),
      messages: messages(),
      tabStop: ctx.tabStop,
      holdsControls: ctx.measured && (ctx.overflow.x || ctx.overflow.y) && ctx.tabbableContent,
      overflow: ctx.overflow,
      edges: ctx.edges,
      focused: focused(),
      modality: modality(),
      stickyFirstColumn: own.stickyFirstColumn === true,
      empty: emptyCount() > 0,
      captionId: captionId() ?? frameCtx?.titleId(),
      tableLabel: tableLabel(),
      describeSort: mounted() && quirkActive("talkback-aria-sort", env),
      pinned: view().values.pinnedColumns,
      expandedRows: view().values.expandedRows,
    })
  })
  const ctx: Ctx = {
    api,
    send,
    state,
    instance,
    captionId: () => `table-${instance()}-caption`,
    registry,
    captioned: () => captionId() !== undefined,
    frame: frameCtx,
    columns,
    setEmpty: (d) => setEmptyCount((n) => n + d),
    setTableLabel,
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api().root()), {
          onFocusIn: (e: FocusEvent) => {
            if (e.target !== e.currentTarget) return
            setFocused(true)
            send({ type: "ROOT.FOCUS" })
          },
          onFocusOut: (e: FocusEvent) => {
            if (e.target !== e.currentTarget) return
            setFocused(false)
            send({ type: "ROOT.BLUR" })
          },
        }),
        ...(rest.id === undefined ? {} : { id: rest.id }),
      },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <TableContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </TableContext.Provider>
  )
}

export type TableTableProps = Own<JSX.HTMLAttributes<HTMLTableElement>> & {
  /** `aria-busy="true"` and `data-loading`. */
  readonly loading?: boolean | undefined
}

function TableElement(props: TableTableProps) {
  const [local, rest] = splitProps(props, ["render", "loading", "children"])
  const ctx = useTable("Table")
  createComputed(() => ctx.setTableLabel(rest["aria-label"]))
  const [el, setEl] = createSignal<HTMLTableElement | null>(null)
  // After commit: the Caption, or a label, names the table (spec "Name").
  afterMount(() => {
    if (process.env.NODE_ENV === "production") return
    // After the re-render a Caption or a Title causes when it registers.
    queueMicrotask(() => {
      const t = el()
      if (!t?.isConnected) return
      if (t.caption || t.hasAttribute("aria-label") || t.hasAttribute("aria-labelledby")) return
      warnOnce(
        ctx.instance(),
        "a table needs a name: render Table.Caption, Table.Title or aria-label",
      )
    })
  })
  // No Caption and no label of its own: the Frame's Title names it.
  const titled = () =>
    !ctx.captioned() &&
    rest["aria-label"] === undefined &&
    rest["aria-labelledby"] === undefined &&
    ctx.frame?.titleId() !== undefined
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(ctx.api().table({ loading: local.loading === true })),
      { ref: setEl, ...(titled() ? { "aria-labelledby": ctx.frame?.titleId() } : {}) },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <table {...p}>{children()}</table>
  ))
}

const warned = new Set<string>()
function warnOnce(instance: string, message: string) {
  // The guarded caller is dropped in production, but not this function: return first, so the
  // minifier drops the message too.
  if (process.env.NODE_ENV === "production") return
  const key = `${instance}:${message}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[rind-ui] table: ${message}`)
}

function Caption(props: Own<JSX.HTMLAttributes<HTMLElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTable("Caption")
  const own = () => rest.id ?? ctx.captionId()
  useRegisterPart(ctx.registry, "caption", own)
  const setCaption = ctx.frame?.setCaption
  createEffect(() => {
    const id = own()
    setCaption?.(id)
    onCleanup(() => setCaption?.(undefined))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().caption(own())), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <caption {...p}>{children()}</caption>
  ))
}

function Head(props: Own<JSX.HTMLAttributes<HTMLTableSectionElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTable("Head")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().head()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <thead {...p}>{children()}</thead>
  ))
}

function Body(props: Own<JSX.HTMLAttributes<HTMLTableSectionElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTable("Body")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().body()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <tbody {...p}>{children()}</tbody>
  ))
}

function Foot(props: Own<JSX.HTMLAttributes<HTMLTableSectionElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTable("Foot")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().foot()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <tfoot {...p}>{children()}</tfoot>
  ))
}

export type TableRowProps = Own<JSX.HTMLAttributes<HTMLTableRowElement>> & {
  /** The row id: needed to expand it (`expandedRows`, RowTrigger, RowDetails). */
  readonly id?: string | undefined
}

interface RowCtx {
  readonly id: Accessor<string | undefined>
  /** The RowHeader's text (measured after mount; the id until then). */
  readonly text: Accessor<string>
}
const RowContext = createContext<RowCtx>()

/** The leaf columns' count, read from the head after mount and as it changes (Empty, RowDetails). */
function useLeafColumns(row: Accessor<Element | null>, given: () => number | undefined) {
  const [counted, setCounted] = createSignal<number | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      const node = row()
      if (given() !== undefined || !node) return
      const table = node.closest("table")
      const count = () => {
        const last = table?.tHead?.rows[(table.tHead?.rows.length ?? 1) - 1]
        if (!last) return
        let n = 0
        for (const cell of Array.from(last.cells)) n += cell.colSpan || 1
        setCounted(n)
      }
      count()
      if (!table?.tHead) return
      const observer = new MutationObserver(count)
      observer.observe(table.tHead, { childList: true, subtree: true, attributes: true })
      onCleanup(() => observer.disconnect())
    })
  })
  return () => given() ?? counted()
}

function Row(props: TableRowProps) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useTable("Row")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const [text, setText] = createSignal<string | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      const node = el()
      if (local.id === undefined || !node) return
      const read = () => {
        const header = node.querySelector<HTMLElement>(':scope > [data-part="row-header"]')
        setText(header ? visibleText(header) : undefined)
      }
      read()
      const observer = new MutationObserver(read)
      observer.observe(node, { childList: true, characterData: true, subtree: true })
      onCleanup(() => observer.disconnect())
    })
  })
  const domId = () =>
    local.id === undefined ? undefined : itemId("table", ctx.instance(), "row", local.id)
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(ctx.api().row(local.id)),
      { ref: setEl, ...(domId() ? { id: domId() } : {}) },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <RowContext.Provider value={{ id: () => local.id, text: () => text() ?? local.id ?? "" }}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <tr {...p}>{children()}</tr>
      ))}
    </RowContext.Provider>
  )
}

export type TableButtonProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function RowTrigger(props: TableButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTable("RowTrigger")
  const row = useContext(RowContext)
  if (!row || row.id() === undefined) {
    throw new Error("Table.RowTrigger must be inside a Table.Row with an `id`")
  }
  const rowId = () => row.id() as string
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const merged = createMemo(() => {
    const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    return mergeProps(
      joinHandlers(
        normalizeProps(
          ctx.api().rowTrigger(rowId(), {
            text: row.text(),
            named,
            focused: focused(),
            modality: modality(),
          }),
        ),
        {
          onClick: () => ctx.send({ type: "ROW.TOGGLE", row: rowId() }),
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        },
      ),
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type TableRowDetailsProps = Own<JSX.HTMLAttributes<HTMLTableRowElement>> & {
  /** The id of the Row these details belong to (render it right after that Row). */
  readonly rowId: string
  /** The cell's span; default: the leaf columns counted after mount. */
  readonly colSpan?: number | undefined
  /** Props of the one cell spanning the row. */
  readonly cellProps?: JSX.TdHTMLAttributes<HTMLTableCellElement> | undefined
}

function RowDetails(props: TableRowDetailsProps) {
  const [local, rest] = splitProps(props, ["render", "rowId", "colSpan", "cellProps", "children"])
  const ctx = useTable("RowDetails")
  const [row, setRow] = createSignal<Element | null>(null)
  const span = useLeafColumns(row, () => local.colSpan)
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().rowDetails(local.rowId)), { ref: setRow }, rest),
  )
  const children = () => (
    <td colSpan={span()} {...local.cellProps}>
      {resolveChildren(local.children, ctx.state)}
    </td>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => <tr {...p}>{children()}</tr>)
}

export type TableColumnHeaderProps = Own<JSX.ThHTMLAttributes<HTMLTableCellElement>> & {
  /** Holds a SortTrigger; needs `id`. */
  readonly sortable?: boolean | undefined
  /** The column id: unique in the table, what `sort.column` and `pinnedColumns` hold. */
  readonly id?: string | undefined
  /** The direction of a first press on this column. Default `ascending`. */
  readonly firstDirection?: SortDirection | undefined
}

function ColumnHeader(props: TableColumnHeaderProps) {
  const [local, rest] = splitProps(props, [
    "render",
    "sortable",
    "id",
    "firstDirection",
    "colSpan",
    "children",
  ])
  const ctx = useTable("ColumnHeader")
  if (local.sortable && (local.id === undefined || local.id === "")) {
    throw new Error("Table.ColumnHeader: a sortable column needs a non-empty `id`")
  }
  createEffect(() => {
    const id = local.id
    if (id === undefined) return
    if (process.env.NODE_ENV !== "production" && ctx.columns.has(id)) {
      console.error(`[rind-ui] table: two columns have the id "${id}"`)
    }
    ctx.columns.add(id)
    onCleanup(() => {
      ctx.columns.delete(id)
    })
  })
  const domId = () =>
    local.id === undefined ? undefined : itemId("table", ctx.instance(), "column", local.id)
  // A Filter inside: the header is named by its text alone (MUI-X#19239); the text is read
  // after mount, without the filter's own button.
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const [filters, setFilters] = createSignal(0)
  const [text, setText] = createSignal<string | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      const th = el()
      if (!th || filters() === 0) return
      const read = () => {
        const copy = th.cloneNode(true) as HTMLElement
        for (const n of Array.from(copy.querySelectorAll('[data-part="filter-trigger"]')))
          n.remove()
        setText(visibleText(copy))
      }
      read()
      const observer = new MutationObserver(read)
      observer.observe(th, { childList: true, characterData: true, subtree: true })
      onCleanup(() => observer.disconnect())
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(
        ctx.api().columnHeader({
          colSpan: num(local.colSpan),
          column: local.id,
          sortable: local.sortable === true,
          controls: filters() > 0,
          text: text(),
        }),
      ),
      { colSpan: local.colSpan, ...(domId() ? { id: domId() } : {}), ref: setEl },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <ColumnContext.Provider
      value={{
        id: () => local.id,
        firstDirection: () => local.firstDirection ?? "ascending",
        sortable: () => local.sortable === true,
        text: () => text() ?? local.id ?? "",
        addFilter: () => {
          setFilters((n) => n + 1)
          return () => setFilters((n) => n - 1)
        },
      }}
    >
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <th {...p}>{children()}</th>
      ))}
    </ColumnContext.Provider>
  )
}

export type TableRowHeaderProps = Own<JSX.ThHTMLAttributes<HTMLTableCellElement>>

function RowHeader(props: TableRowHeaderProps) {
  const [local, rest] = splitProps(props, ["render", "rowSpan", "children"])
  const ctx = useTable("RowHeader")
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(ctx.api().rowHeader({ rowSpan: num(local.rowSpan) })),
      { rowSpan: local.rowSpan },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => <th {...p}>{children()}</th>)
}

export type TableCellProps = Own<JSX.TdHTMLAttributes<HTMLTableCellElement>>

function Cell(props: TableCellProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTable("Cell")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().cell()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => <td {...p}>{children()}</td>)
}

function SortTrigger(props: TableButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTable("SortTrigger")
  const column = useContext(ColumnContext)
  if (!column?.sortable()) {
    throw new Error("Table.SortTrigger must be inside a sortable Table.ColumnHeader")
  }
  // A sortable column always has an id (the ColumnHeader throws otherwise).
  const columnId = () => column.id() as string
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const state = createMemo(() => ctx.api().sortState(columnId()))
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        normalizeProps(
          ctx.api().sortTrigger(columnId(), { focused: focused(), modality: modality() }),
        ),
        {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
          // A native button: pointer, Enter, Space and an assistive technology's bare click.
          onClick: (e: MouseEvent) =>
            ctx.send({
              type: "SORT",
              column: columnId(),
              name: visibleText(e.currentTarget as HTMLElement),
              firstDirection: column.firstDirection(),
              modality: env.modality.modality(),
            }),
        },
      ),
      rest,
    ),
  )
  const children = () => (
    <>
      {resolveChildren(local.children, ctx.state)}
      {/* Hidden from the name (aria-hidden); still read as the description. */}
      <Show when={state()}>
        {(s) => (
          <VisuallyHidden id={s().id} aria-hidden="true">
            {s().text}
          </VisuallyHidden>
        )}
      </Show>
    </>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type TableSortIndicatorProps = Own<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while sorted ascending (else `children`). */
  readonly ascending?: JSX.Element
  /** Rendered while sorted descending (else `children`). */
  readonly descending?: JSX.Element
  /** Rendered while not sorted (else `children`). */
  readonly none?: JSX.Element
}

function SortIndicator(props: TableSortIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "ascending", "descending", "none", "children"])
  const ctx = useTable("SortIndicator")
  const column = useContext(ColumnContext)
  if (!column?.sortable()) {
    throw new Error("Table.SortIndicator must be inside a sortable Table.ColumnHeader")
  }
  const columnId = () => column.id() as string
  const direction = () => {
    const sort = ctx.state.sort
    return sort?.column === columnId() ? sort.direction : "none"
  }
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().sortIndicator(columnId())), rest),
  )
  // Else the provider's icon for the direction; else nothing (the theme draws the shape).
  const children = () => {
    const d = direction()
    const base = resolveChildren(local.children, ctx.state)
    const own =
      d === "ascending"
        ? (local.ascending ?? base)
        : d === "descending"
          ? (local.descending ?? base)
          : (local.none ?? base)
    return (
      <IconChildren
        name={d === "ascending" ? "caret-up" : d === "descending" ? "caret-down" : "caret-up-down"}
      >
        {own}
      </IconChildren>
    )
  }
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

// ── Frame, Header, Footer and the full-page view (table-columns-and-toolbar design §4) ──

interface FrameCtx {
  readonly instance: Accessor<string>
  readonly api: Accessor<ReturnType<typeof tableFrameConnect>>
  readonly send: (event: TableFrameEvent) => void
  readonly expanded: Accessor<boolean>
  readonly setCaption: (id: string | undefined) => void
  /** The Title's id: names the table and the full-page view when there is no Caption. */
  readonly titleId: Accessor<string | undefined>
  readonly setTitle: (id: string | undefined) => void
}
const FrameContext = createContext<FrameCtx>()
function useFrame(part: string): FrameCtx {
  const ctx = useContext(FrameContext)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Frame`)
  return ctx
}

export interface TableFrameRenderState {
  readonly expanded: boolean
}

type FramePartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and `{ expanded }`. */
  readonly render?: RenderProp<TableFrameRenderState> | undefined
  readonly children?: JSX.Element | ((state: TableFrameRenderState) => JSX.Element)
}

export type TableFrameProps = FramePartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Full page: the Frame covers the viewport as a modal dialog (controllable). */
  readonly expanded?: boolean | undefined
  readonly defaultExpanded?: boolean | undefined
  readonly onExpandedChange?:
    | ((expanded: boolean, details: ChangeDetails<TableFrameEvent>) => void)
    | undefined
  /** Overrides the strings ("Full page"); also through the provider. */
  readonly messages?: MessageOverrides<TableMessages> | undefined
}

function Frame(props: TableFrameProps) {
  const [own, rest] = splitProps(props, [
    "expanded",
    "defaultExpanded",
    "onExpandedChange",
    "messages",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const messages = useMessages("table", tableMessages, () => own.messages)
  const env = useEnvironment()
  const { view, send } = useMachine(
    tableFrameMachine,
    () => ({
      root: instance(),
      expanded: own.expanded,
      defaultExpanded: own.defaultExpanded,
      onExpandedChange: own.onExpandedChange,
    }),
    env,
  )
  const [captionId, setCaption] = createSignal<string | undefined>(undefined)
  const [titleId, setTitle] = createSignal<string | undefined>(undefined)
  const isExpanded = () => view().values.expanded
  const api = createMemo(() =>
    tableFrameConnect({
      instance: instance(),
      expanded: isExpanded(),
      messages: messages(),
      captionId: captionId() ?? titleId(),
      ids: tableFrameIds(instance()),
    }),
  )
  const ctx: FrameCtx = {
    instance,
    api,
    send,
    expanded: isExpanded,
    setCaption,
    titleId,
    setTitle,
  }
  const state = reactive<TableFrameRenderState>(() => ({ expanded: isExpanded() }))
  const merged = createMemo(() => mergeProps(normalizeProps(api().frame()), rest))
  const children = () => resolveChildren(own.children, state)
  return (
    <FrameContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </FrameContext.Provider>
  )
}

function frameState(f: FrameCtx) {
  return reactive<TableFrameRenderState>(() => ({ expanded: f.expanded() }))
}

export type TableFrameDivProps = FramePartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Header(props: TableFrameDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const f = useFrame("Header")
  const state = frameState(f)
  const merged = createMemo(() => mergeProps(normalizeProps(f.api().header()), rest))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

function Footer(props: TableFrameDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const f = useFrame("Footer")
  const state = frameState(f)
  const merged = createMemo(() => mergeProps(normalizeProps(f.api().footer()), rest))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

function Title(props: TableFrameDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const f = useFrame("Title")
  const state = frameState(f)
  const own = () => rest.id ?? `table-${f.instance()}-title`
  createEffect(() => {
    f.setTitle(own())
    onCleanup(() => f.setTitle(undefined))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(f.api().title(own())), rest))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

export type TableExpandTriggerProps = FramePartProps<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>
> & {
  /** Rendered while full page (else `children`). */
  readonly expanded?: JSX.Element
  /** Rendered while in place (else `children`). */
  readonly collapsed?: JSX.Element
}

function ExpandTrigger(props: TableExpandTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "expanded", "collapsed", "children"])
  const f = useFrame("ExpandTrigger")
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const state = frameState(f)
  const given = resolve(() => resolveChildren(local.children, state))
  const merged = createMemo(() => {
    const c = given()
    const named = c !== undefined && c !== null && c !== false
    return mergeProps(
      joinHandlers(
        normalizeProps(f.api().expandTrigger({ named, focused: focused(), modality: modality() })),
        {
          onClick: () => f.send({ type: "TOGGLE" }),
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        },
      ),
      rest,
    )
  })
  const children = () => (
    <IconChildren name={f.expanded() ? "arrows-in" : "arrows-out"}>
      {f.expanded() ? (local.expanded ?? given()) : (local.collapsed ?? given())}
    </IconChildren>
  )
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

// ── Filters: a Popover scoped to the table, inside a ColumnHeader (design §2) ──

interface FilterCtx {
  readonly column: ColumnCtx
  readonly active: Accessor<boolean>
}
const FilterContext = createContext<FilterCtx>()
function useFilter(part: string): FilterCtx {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Filter`)
  return ctx
}

export interface TableFilterProps {
  /** The column is filtered: the trigger is marked and described "Filtered". */
  readonly active?: boolean | undefined
  /** Controlled open state of the filter popover. */
  readonly open?: boolean | undefined
  /** Uncontrolled initial open state. */
  readonly defaultOpen?: boolean | undefined
  /** The popover proposes opening or closing. */
  readonly onOpenChange?: PopoverRootProps["onOpenChange"] | undefined
  /** The FilterTrigger and the FilterContent. */
  readonly children?: JSX.Element
}

function Filter(props: TableFilterProps) {
  const [local, rest] = splitProps(props, ["active", "children"])
  const column = useContext(ColumnContext)
  if (!column || column.id() === undefined) {
    throw new Error("Table.Filter must be inside a Table.ColumnHeader with an `id`")
  }
  createEffect(() => onCleanup(column.addFilter()))
  return (
    <FilterContext.Provider value={{ column, active: () => local.active === true }}>
      <ScopedPopoverRoot scope="table" {...rest}>
        {local.children}
      </ScopedPopoverRoot>
    </FilterContext.Provider>
  )
}

export type TableFilterTriggerProps = Omit<PopoverTriggerProps, "children"> & {
  readonly children?: JSX.Element
}

function FilterTrigger(props: TableFilterTriggerProps) {
  const [local, rest] = splitProps(props, ["children"])
  const ctx = useTable("FilterTrigger")
  const f = useFilter("FilterTrigger")
  const columnId = () => f.column.id() as string
  const merged = createMemo(() => {
    const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    return mergeProps(
      normalizeProps(
        ctx.api().filterTrigger(columnId(), {
          text: f.column.text(),
          active: f.active(),
          named,
        }),
      ),
      rest,
    )
  })
  const state = createMemo(() => ctx.api().filterState(columnId(), f.active()))
  return (
    <Popover.Trigger {...merged()}>
      {local.children}
      <Show when={state()}>
        {(s) => (
          <VisuallyHidden id={s().id} aria-hidden="true">
            {s().text}
          </VisuallyHidden>
        )}
      </Show>
    </Popover.Trigger>
  )
}

export type TableFilterContentProps = PopoverContentProps & {
  /** Props of the Positioner around the content. */
  readonly positionerProps?: JSX.HTMLAttributes<HTMLDivElement> | undefined
}

function FilterContent(props: TableFilterContentProps) {
  const [local, rest] = splitProps(props, ["positionerProps", "children"])
  const ctx = useTable("FilterContent")
  const f = useFilter("FilterContent")
  const label = () =>
    ctx.api().filterTrigger(f.column.id() as string, {
      text: f.column.text(),
      active: false,
      named: false,
    })["aria-label"] as string
  return (
    <Popover.Portal>
      <Popover.Positioner data-part="filter-positioner" {...local.positionerProps}>
        <Popover.Content data-part="filter-content" aria-label={label()} {...rest}>
          {local.children}
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Portal>
  )
}

export type TableFilterIndicatorProps = Own<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while the column is filtered (else `children`). */
  readonly active?: JSX.Element
}

function FilterIndicator(props: TableFilterIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "active", "children"])
  const ctx = useTable("FilterIndicator")
  const f = useFilter("FilterIndicator")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().filterIndicator(f.active())), rest),
  )
  const children = () => (
    <IconChildren name={f.active() ? "funnel" : "funnel-simple"}>
      {f.active()
        ? (local.active ?? resolveChildren(local.children, ctx.state))
        : resolveChildren(local.children, ctx.state)}
    </IconChildren>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type TableEmptyProps = Own<JSX.HTMLAttributes<HTMLTableRowElement>> & {
  /** The cell's span; default: the leaf columns counted after mount (one on the server). */
  readonly colSpan?: number | undefined
}

function Empty(props: TableEmptyProps) {
  const [local, rest] = splitProps(props, ["render", "colSpan", "children"])
  const ctx = useTable("Empty")
  const [row, setRow] = createSignal<Element | null>(null)
  createEffect(() => {
    ctx.setEmpty(1)
    onCleanup(() => ctx.setEmpty(-1))
  })
  const span = useLeafColumns(row, () => local.colSpan)
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().empty()), { ref: setRow }, rest),
  )
  const children = () => <td colSpan={span()}>{resolveChildren(local.children, ctx.state)}</td>
  return renderPart(local.render, merged, ctx.state, children, (p) => <tr {...p}>{children()}</tr>)
}

/** The parts, by name: `table.parts.ts` re-exports them as the `Table` namespace. */
export {
  Body,
  Caption,
  Cell,
  ColumnHeader,
  Empty,
  ExpandTrigger,
  Filter,
  FilterContent,
  FilterIndicator,
  FilterTrigger,
  Foot,
  Footer,
  Frame,
  Head,
  Header,
  Root,
  Row,
  RowDetails,
  RowHeader,
  RowTrigger,
  SortIndicator,
  SortTrigger,
  TableElement as Table,
  Title,
}
