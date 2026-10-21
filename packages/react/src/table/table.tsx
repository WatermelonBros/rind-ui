"use client"

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
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useIconChildren } from "../icons"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Popover, type PopoverRootProps } from "../popover"
import { ScopedPopoverRoot } from "../popover/popover"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
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

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
export interface TableRenderState {
  readonly sort: SortDescriptor | null
  readonly scrollStop: boolean
}

type Api = ReturnType<typeof tableConnect>

interface Ctx {
  readonly api: Api
  readonly send: (event: TableEvent) => void
  readonly state: TableRenderState
  readonly instance: string
  readonly captionId: string
  readonly registry: PartRegistry<"caption">
  readonly captioned: boolean
  /** The Frame around the Root, when there is one (the Caption names it while expanded). */
  readonly frame: FrameCtx | null
  /** Sortable column ids, for the duplicate check. */
  readonly columns: Set<string>
  readonly setEmpty: (delta: 1 | -1) => void
  readonly tableLabel: { current: string | undefined }
}
const TableContext = createContext<Ctx | null>(null)
function useTable(part: string): Ctx {
  const ctx = useContext(TableContext)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Root`)
  return ctx
}

interface ColumnCtx {
  readonly id: string
  readonly firstDirection: SortDirection
  readonly sortable: boolean
  /** The column's text (measured after mount; the id until then). */
  readonly text: string
  /** A Filter registers while mounted. */
  readonly addFilter: () => () => void
}
const ColumnContext = createContext<ColumnCtx | null>(null)

const box = (value: SortDescriptor | null): TableSortValue => ({ value })

export type TableRootProps = ComponentPropsWithRef<"div"> & {
  /** Controlled sort; `null` is controlled and unsorted. The Table never reorders rows. */
  readonly sort?: SortDescriptor | null
  readonly defaultSort?: SortDescriptor | null
  /** A press proposes the next sort; `details.event.column`, `details.cancel()`. */
  readonly onSortChange?: (sort: SortDescriptor | null, details: ChangeDetails<TableEvent>) => void
  /** A press on the sorted column at the opposite of its first direction clears the sort. */
  readonly allowUnsorted?: boolean
  /** `data-sticky-first-column` on the Root (the theme pins the first cell of each row). */
  readonly stickyFirstColumn?: boolean
  /** Column ids pinned at the inline start and end (controllable). */
  readonly pinnedColumns?: PinnedColumns
  readonly defaultPinnedColumns?: PinnedColumns
  readonly onPinnedColumnsChange?: (
    pinned: PinnedColumns,
    details: ChangeDetails<TableEvent>,
  ) => void
  /** Row ids whose details are open (controllable). */
  readonly expandedRows?: readonly string[]
  readonly defaultExpandedRows?: readonly string[]
  readonly onExpandedRowsChange?: (
    rows: readonly string[],
    details: ChangeDetails<TableEvent>,
  ) => void
  /** Several rows open at once (default); `false`: opening one closes the others. */
  readonly multiple?: boolean
  /** The rows shown (after filters): announced when it changes. */
  readonly rowCount?: number
  /** With pagination: the rows shown of the total, announced instead of the count. */
  readonly rowRange?: RowRange
  readonly messages?: MessageOverrides<TableMessages>
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string
  readonly render?: RenderProp<TableRenderState>
}

function Root({
  sort,
  defaultSort,
  onSortChange,
  allowUnsorted,
  stickyFirstColumn = false,
  pinnedColumns,
  defaultPinnedColumns,
  onPinnedColumnsChange,
  rowCount,
  rowRange,
  expandedRows,
  defaultExpandedRows,
  onExpandedRowsChange,
  multiple,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: TableRootProps) {
  // Inside a Frame the Root shares its instance: every part of the table is one instance.
  const frameCtx = useContext(FrameContext)
  const instance = useRootId(id ?? frameCtx?.instance)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("table", tableMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const registry = usePartRegistry<"caption">({ scope: "table", root: instance })
  const tableEnv = useMemo(() => ({ ...env, tableMetrics: domTableMetrics(env) }), [env])
  // One box per descriptor: the machine compares by content, React by identity.
  const sortKey =
    sort === undefined ? "u" : sort === null ? "n" : `${sort.column}\u0000${sort.direction}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the descriptor's content
  const controlled = useMemo(() => (sort === undefined ? undefined : box(sort)), [sortKey])
  const [initial] = useState(() => (defaultSort === undefined ? undefined : box(defaultSort)))
  const { view, send } = useMachine(
    tableMachine,
    {
      root: instance,
      messages,
      lang: locale,
      sort: controlled,
      defaultSort: initial,
      onSortChange: onSortChange ? (s, details) => onSortChange(s.value, details) : undefined,
      allowUnsorted,
      pinnedColumns,
      defaultPinnedColumns,
      onPinnedColumnsChange,
      rowCount,
      rowRange,
      expandedRows,
      defaultExpandedRows,
      onExpandedRowsChange,
      multiple,
    },
    tableEnv,
  )
  const frame = frameCtx
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [emptyCount, setEmptyCount] = useState(0)
  const columns = useRef(new Set<string>()).current
  const tableLabel = useRef<string | undefined>(undefined)
  const captionId = useRenderedId(registry, "caption")
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const current = view.values.sort.value
  const state: TableRenderState = { sort: current, scrollStop: view.context.tabStop }
  const api = tableConnect({
    instance,
    sort: current,
    messages,
    tabStop: view.context.tabStop,
    holdsControls:
      view.context.measured &&
      (view.context.overflow.x || view.context.overflow.y) &&
      view.context.tabbableContent,
    overflow: view.context.overflow,
    edges: view.context.edges,
    focused,
    modality,
    stickyFirstColumn,
    empty: emptyCount > 0,
    captionId: captionId ?? frame?.titleId,
    tableLabel: tableLabel.current,
    describeSort: mounted && quirkActive("talkback-aria-sort", env),
    pinned: view.values.pinnedColumns,
    expandedRows: view.values.expandedRows,
  })
  const ctx: Ctx = {
    api,
    send,
    state,
    instance,
    captionId: `table-${instance}-caption`,
    registry,
    captioned: captionId !== undefined,
    frame,
    columns,
    setEmpty: (d) => setEmptyCount((n) => n + d),
    tableLabel,
  }
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(api.root()), {
        onFocus: (e: React.FocusEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return
          setFocused(true)
          send({ type: "ROOT.FOCUS" })
        },
        onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return
          setFocused(false)
          send({ type: "ROOT.BLUR" })
        },
      }),
      ...(id === undefined ? {} : { id }),
      ref,
    },
    rest,
  )
  return (
    <TableContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </TableContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<TableRenderState>
}

export type TableTableProps = PartProps<"table"> & {
  /** `aria-busy="true"` and `data-loading`. */
  readonly loading?: boolean
}

function TableElement({ render, loading = false, ref, ...rest }: TableTableProps) {
  const ctx = useTable("Table")
  ctx.tableLabel.current = rest["aria-label"]
  const el = useRef<HTMLTableElement | null>(null)
  // After commit: the Caption, or a label, names the table (spec "Name").
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    // After the re-render a Caption or a Title causes when it registers.
    queueMicrotask(() => {
      const t = el.current
      if (!t?.isConnected) return
      if (t.caption || t.hasAttribute("aria-label") || t.hasAttribute("aria-labelledby")) return
      warnOnce(
        ctx.instance,
        "a table needs a name: render Table.Caption, Table.Title or aria-label",
      )
    })
  })
  // No Caption and no label of its own: the Frame's Title names it.
  const titled =
    !ctx.captioned &&
    rest["aria-label"] === undefined &&
    rest["aria-labelledby"] === undefined &&
    ctx.frame?.titleId !== undefined
  return renderPart(
    "table",
    mergeProps(
      normalizeProps(ctx.api.table({ loading })),
      { ref: composeRefs(el, ref), ...(titled ? { "aria-labelledby": ctx.frame?.titleId } : {}) },
      rest,
    ),
    render,
    ctx.state,
  )
}

const warned = new Set<string>()
function warnOnce(instance: string, message: string) {
  const key = `${instance}:${message}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[rind-ui] table: ${message}`)
}

function Caption({ render, id, ...rest }: PartProps<"caption">) {
  const ctx = useTable("Caption")
  const own = id ?? ctx.captionId
  useRegisterPart(ctx.registry, "caption", own)
  const setCaption = ctx.frame?.setCaption
  useIsoLayoutEffect(() => {
    setCaption?.(own)
    return () => setCaption?.(undefined)
  }, [own, setCaption])
  return renderPart(
    "caption",
    mergeProps(normalizeProps(ctx.api.caption(own)), rest),
    render,
    ctx.state,
  )
}

function Head({ render, ...rest }: PartProps<"thead">) {
  const ctx = useTable("Head")
  return renderPart("thead", mergeProps(normalizeProps(ctx.api.head()), rest), render, ctx.state)
}

function Body({ render, ...rest }: PartProps<"tbody">) {
  const ctx = useTable("Body")
  return renderPart("tbody", mergeProps(normalizeProps(ctx.api.body()), rest), render, ctx.state)
}

function Foot({ render, ...rest }: PartProps<"tfoot">) {
  const ctx = useTable("Foot")
  return renderPart("tfoot", mergeProps(normalizeProps(ctx.api.foot()), rest), render, ctx.state)
}

export type TableRowProps = PartProps<"tr"> & {
  /** The row id: needed to expand it (`expandedRows`, RowTrigger, RowDetails). */
  readonly id?: string
}

interface RowCtx {
  readonly id: string
  /** The RowHeader's text (measured after mount; the id until then). */
  readonly text: string
}
const RowContext = createContext<RowCtx | null>(null)

/** The leaf columns' count, read from the head after mount (Empty, RowDetails). */
function useLeafColumns(row: { current: HTMLTableRowElement | null }, given: number | undefined) {
  const [counted, setCounted] = useState<number | undefined>(undefined)
  useIsoLayoutEffect(() => {
    if (given !== undefined) return
    const table = row.current?.closest("table")
    const last = table?.tHead?.rows[(table.tHead?.rows.length ?? 1) - 1]
    if (!last) return
    let n = 0
    for (const cell of Array.from(last.cells)) n += cell.colSpan || 1
    if (n !== counted) setCounted(n)
  })
  return given ?? counted
}

function Row({ render, id, ref, ...rest }: TableRowProps) {
  const ctx = useTable("Row")
  const el = useRef<HTMLTableRowElement | null>(null)
  const [text, setText] = useState<string | undefined>(undefined)
  useIsoLayoutEffect(() => {
    if (id === undefined) return
    const header = el.current?.querySelector<HTMLElement>(':scope > [data-part="row-header"]')
    const next = header ? visibleText(header) : undefined
    if (next !== text) setText(next)
  })
  const domId = id === undefined ? undefined : itemId("table", ctx.instance, "row", id)
  const tr = renderPart(
    "tr",
    mergeProps(
      normalizeProps(ctx.api.row(id)),
      { ref: composeRefs(el, ref), ...(domId ? { id: domId } : {}) },
      rest,
    ),
    render,
    ctx.state,
  )
  return id === undefined ? tr : <RowContext value={{ id, text: text ?? id }}>{tr}</RowContext>
}

function RowTrigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useTable("RowTrigger")
  const row = useContext(RowContext)
  if (!row) throw new Error("Table.RowTrigger must be inside a Table.Row with an `id`")
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const props = mergeProps(
    {
      ...joinHandlers(
        normalizeProps(ctx.api.rowTrigger(row.id, { text: row.text, named, focused, modality })),
        {
          onClick: () => ctx.send({ type: "ROW.TOGGLE", row: row.id }),
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        },
      ),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

export type TableRowDetailsProps = PartProps<"tr"> & {
  /** The id of the Row these details belong to (render it right after that Row). */
  readonly rowId: string
  /** The cell's span; default: the leaf columns counted after mount. */
  readonly colSpan?: number
  /** Props of the one cell spanning the row. */
  readonly cellProps?: ComponentPropsWithRef<"td">
}

function RowDetails({
  render,
  rowId,
  colSpan,
  cellProps,
  children,
  ref,
  ...rest
}: TableRowDetailsProps) {
  const ctx = useTable("RowDetails")
  const row = useRef<HTMLTableRowElement | null>(null)
  const span = useLeafColumns(row, colSpan)
  const props = mergeProps(
    normalizeProps(ctx.api.rowDetails(rowId)),
    { ref: composeRefs(row, ref) },
    rest,
  )
  return renderPart(
    "tr",
    {
      ...props,
      children: (
        <td colSpan={span} {...cellProps}>
          {children}
        </td>
      ),
    },
    render,
    ctx.state,
  )
}

export type TableColumnHeaderProps = PartProps<"th"> & {
  /** Holds a SortTrigger; needs `id`. */
  readonly sortable?: boolean
  /** The column id: unique in the table, what `sort.column` and `pinnedColumns` hold. */
  readonly id?: string
  /** The direction of a first press on this column. Default `ascending`. */
  readonly firstDirection?: SortDirection
}

function ColumnHeader({
  render,
  sortable = false,
  id,
  firstDirection = "ascending",
  colSpan,
  ref,
  ...rest
}: TableColumnHeaderProps) {
  const ctx = useTable("ColumnHeader")
  if (sortable && (id === undefined || id === "")) {
    throw new Error("Table.ColumnHeader: a sortable column needs a non-empty `id`")
  }
  useIsoLayoutEffect(() => {
    if (id === undefined) return
    if (process.env.NODE_ENV !== "production" && ctx.columns.has(id)) {
      console.error(`[rind-ui] table: two columns have the id "${id}"`)
    }
    ctx.columns.add(id)
    return () => {
      ctx.columns.delete(id)
    }
  }, [id, ctx.columns])
  // A Filter inside: the header is named by its text alone (MUI-X#19239); the text is read
  // after mount, without the filter's own button.
  const el = useRef<HTMLTableCellElement | null>(null)
  const [filters, setFilters] = useState(0)
  const [text, setText] = useState<string | undefined>(undefined)
  useIsoLayoutEffect(() => {
    const th = el.current
    if (!th || filters === 0) return
    const copy = th.cloneNode(true) as HTMLElement
    for (const n of Array.from(copy.querySelectorAll('[data-part="filter-trigger"]'))) n.remove()
    const next = visibleText(copy)
    if (next !== text) setText(next)
  })
  const api = normalizeProps(
    ctx.api.columnHeader({ colSpan, column: id, sortable, controls: filters > 0, text }),
  )
  const domId = id === undefined ? undefined : itemId("table", ctx.instance, "column", id)
  const props = mergeProps(
    api,
    { colSpan, ref: composeRefs(el, ref), ...(domId ? { id: domId } : {}) },
    rest,
  )
  const th = renderPart("th", props, render, ctx.state)
  if (id === undefined) return th
  return (
    <ColumnContext
      value={{
        id,
        firstDirection,
        sortable,
        text: text ?? id,
        addFilter: () => {
          setFilters((n) => n + 1)
          return () => setFilters((n) => n - 1)
        },
      }}
    >
      {th}
    </ColumnContext>
  )
}

function RowHeader({ render, rowSpan, ...rest }: PartProps<"th">) {
  const ctx = useTable("RowHeader")
  return renderPart(
    "th",
    mergeProps(normalizeProps(ctx.api.rowHeader({ rowSpan })), { rowSpan }, rest),
    render,
    ctx.state,
  )
}

function Cell({ render, ...rest }: PartProps<"td">) {
  const ctx = useTable("Cell")
  return renderPart("td", mergeProps(normalizeProps(ctx.api.cell()), rest), render, ctx.state)
}

function SortTrigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useTable("SortTrigger")
  const column = useContext(ColumnContext)
  if (!column?.sortable) {
    throw new Error("Table.SortTrigger must be inside a sortable Table.ColumnHeader")
  }
  const env = useEnvironment()
  const el = useRef<HTMLButtonElement | null>(null)
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const state = ctx.api.sortState(column.id)
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.sortTrigger(column.id, { focused, modality })), {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        // A native button: pointer, Enter, Space and an assistive technology's bare click.
        onClick: (e: React.MouseEvent<HTMLButtonElement>) =>
          ctx.send({
            type: "SORT",
            column: column.id,
            name: visibleText(e.currentTarget),
            firstDirection: column.firstDirection,
            modality: env.modality.modality(),
          }),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart(
    "button",
    {
      ...props,
      children: (
        <>
          {children}
          {/* Hidden from the name (aria-hidden); still read as the description. */}
          {state ? (
            <VisuallyHidden id={state.id} aria-hidden="true">
              {state.text}
            </VisuallyHidden>
          ) : null}
        </>
      ),
    },
    render,
    ctx.state,
  )
}

export type TableSortIndicatorProps = PartProps<"span"> & {
  /** Rendered while sorted ascending (else `children`). */
  readonly ascending?: ReactNode
  /** Rendered while sorted descending (else `children`). */
  readonly descending?: ReactNode
  /** Rendered while not sorted (else `children`). */
  readonly none?: ReactNode
}

function SortIndicator({
  render,
  ascending,
  descending,
  none,
  children,
  ...rest
}: TableSortIndicatorProps) {
  const ctx = useTable("SortIndicator")
  const column = useContext(ColumnContext)
  if (!column?.sortable) {
    throw new Error("Table.SortIndicator must be inside a sortable Table.ColumnHeader")
  }
  const sort = ctx.state.sort
  const direction = sort?.column === column.id ? sort.direction : "none"
  const own =
    direction === "ascending"
      ? (ascending ?? children)
      : direction === "descending"
        ? (descending ?? children)
        : (none ?? children)
  // Else the provider's icon for the direction; else nothing (the theme draws the shape).
  const shown = useIconChildren(
    direction === "ascending"
      ? "caret-up"
      : direction === "descending"
        ? "caret-down"
        : "caret-up-down",
    own,
  )
  return renderPart(
    "span",
    { ...mergeProps(normalizeProps(ctx.api.sortIndicator(column.id)), rest), children: shown },
    render,
    ctx.state,
  )
}

// ── Frame, Header, Footer and the full-page view (table-columns-and-toolbar design §4) ──

interface FrameCtx {
  readonly instance: string
  readonly api: ReturnType<typeof tableFrameConnect>
  readonly send: (event: TableFrameEvent) => void
  readonly expanded: boolean
  readonly setCaption: (id: string | undefined) => void
  /** The Title's id: names the table and the full-page view when there is no Caption. */
  readonly titleId: string | undefined
  readonly setTitle: (id: string | undefined) => void
}
const FrameContext = createContext<FrameCtx | null>(null)
function useFrame(part: string): FrameCtx {
  const ctx = useContext(FrameContext)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Frame`)
  return ctx
}

export interface TableFrameRenderState {
  readonly expanded: boolean
}

export type TableFrameProps = ComponentPropsWithRef<"div"> & {
  /** Full page: the Frame covers the viewport as a modal dialog (controllable). */
  readonly expanded?: boolean
  readonly defaultExpanded?: boolean
  readonly onExpandedChange?: (expanded: boolean, details: ChangeDetails<TableFrameEvent>) => void
  /** Overrides the strings ("Full page"); also through the provider. */
  readonly messages?: MessageOverrides<TableMessages>
  /** Another element or a render function receiving the props and `{ expanded }`. */
  readonly render?: RenderProp<TableFrameRenderState>
}

function Frame({
  expanded,
  defaultExpanded,
  onExpandedChange,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  ...rest
}: TableFrameProps) {
  const instance = useRootId(id)
  const messages = useMessages("table", tableMessages, ownMessages)
  const env = useEnvironment()
  const { view, send } = useMachine(
    tableFrameMachine,
    {
      root: instance,
      expanded,
      defaultExpanded,
      onExpandedChange,
    },
    env,
  )
  const [captionId, setCaption] = useState<string | undefined>(undefined)
  const [titleId, setTitle] = useState<string | undefined>(undefined)
  const isExpanded = view.values.expanded
  const api = tableFrameConnect({
    instance,
    expanded: isExpanded,
    messages,
    captionId: captionId ?? titleId,
    ids: tableFrameIds(instance),
  })
  const ctx: FrameCtx = {
    instance,
    api,
    send,
    expanded: isExpanded,
    setCaption,
    titleId,
    setTitle,
  }
  const props = mergeProps({ ...normalizeProps(api.frame()), ref }, rest)
  return (
    <FrameContext value={ctx}>
      {renderPart("div", { ...props, children }, render, { expanded: isExpanded })}
    </FrameContext>
  )
}

type FramePartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and `{ expanded }`. */
  readonly render?: RenderProp<TableFrameRenderState>
}

function Header({ render, ...rest }: FramePartProps<"div">) {
  const f = useFrame("Header")
  return renderPart("div", mergeProps(normalizeProps(f.api.header()), rest), render, {
    expanded: f.expanded,
  })
}

function Footer({ render, ...rest }: FramePartProps<"div">) {
  const f = useFrame("Footer")
  return renderPart("div", mergeProps(normalizeProps(f.api.footer()), rest), render, {
    expanded: f.expanded,
  })
}

function Title({ render, id, ...rest }: FramePartProps<"div">) {
  const f = useFrame("Title")
  const own = id ?? `table-${f.instance}-title`
  const { setTitle } = f
  useIsoLayoutEffect(() => {
    setTitle(own)
    return () => setTitle(undefined)
  }, [own, setTitle])
  return renderPart("div", mergeProps(normalizeProps(f.api.title(own)), rest), render, {
    expanded: f.expanded,
  })
}

export type TableExpandTriggerProps = FramePartProps<"button"> & {
  /** Rendered while full page (else `children`). */
  readonly expanded?: ReactNode
  /** Rendered while in place (else `children`). */
  readonly collapsed?: ReactNode
}

function ExpandTrigger({
  render,
  expanded,
  collapsed,
  children,
  ref,
  ...rest
}: TableExpandTriggerProps) {
  const f = useFrame("ExpandTrigger")
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const own = f.expanded ? (expanded ?? children) : (collapsed ?? children)
  const named = children !== undefined && children !== null && children !== false
  const shown = useIconChildren(f.expanded ? "arrows-in" : "arrows-out", own)
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(f.api.expandTrigger({ named, focused, modality })), {
        onClick: () => f.send({ type: "TOGGLE" }),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children: shown }, render, { expanded: f.expanded })
}

// ── Filters: a Popover scoped to the table, inside a ColumnHeader (design §2) ──

interface FilterCtx {
  readonly column: ColumnCtx
  readonly active: boolean
}
const FilterContext = createContext<FilterCtx | null>(null)
function useFilter(part: string): FilterCtx {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Filter`)
  return ctx
}

export interface TableFilterProps {
  /** The column is filtered: the trigger is marked and described "Filtered". */
  readonly active?: boolean
  /** Controlled open state of the filter popover. */
  readonly open?: boolean
  /** Uncontrolled initial open state. */
  readonly defaultOpen?: boolean
  /** The popover proposes opening or closing. */
  readonly onOpenChange?: PopoverRootProps["onOpenChange"]
  /** The FilterTrigger and the FilterContent. */
  readonly children?: ReactNode
}

function Filter({ active = false, children, ...rest }: TableFilterProps) {
  const column = useContext(ColumnContext)
  if (!column) throw new Error("Table.Filter must be inside a Table.ColumnHeader with an `id`")
  const { addFilter } = column
  useIsoLayoutEffect(() => addFilter(), [addFilter])
  return (
    <FilterContext value={{ column, active }}>
      <ScopedPopoverRoot scope="table" {...rest}>
        {children}
      </ScopedPopoverRoot>
    </FilterContext>
  )
}

function FilterTrigger({ children, ...rest }: ComponentPropsWithRef<typeof Popover.Trigger>) {
  const ctx = useTable("FilterTrigger")
  const f = useFilter("FilterTrigger")
  const own = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const api = normalizeProps(
    ctx.api.filterTrigger(f.column.id, { text: f.column.text, active: f.active, named: own }),
  )
  const state = ctx.api.filterState(f.column.id, f.active)
  return (
    <Popover.Trigger {...(api as object)} {...rest}>
      {children}
      {state ? (
        <VisuallyHidden id={state.id} aria-hidden="true">
          {state.text}
        </VisuallyHidden>
      ) : null}
    </Popover.Trigger>
  )
}

export type TableFilterContentProps = ComponentPropsWithRef<typeof Popover.Content> & {
  /** Props of the Positioner around the content. */
  readonly positionerProps?: ComponentPropsWithRef<typeof Popover.Positioner>
}

function FilterContent({ positionerProps, ...rest }: TableFilterContentProps) {
  const ctx = useTable("FilterContent")
  const f = useFilter("FilterContent")
  return (
    <Popover.Portal>
      <Popover.Positioner data-part="filter-positioner" {...positionerProps}>
        <Popover.Content
          data-part="filter-content"
          aria-label={
            ctx.api.filterTrigger(f.column.id, {
              text: f.column.text,
              active: false,
              named: false,
            })["aria-label"] as string
          }
          {...rest}
        />
      </Popover.Positioner>
    </Popover.Portal>
  )
}

export type TableFilterIndicatorProps = PartProps<"span"> & {
  /** Rendered while the column is filtered (else `children`). */
  readonly active?: ReactNode
}

function FilterIndicator({ render, active, children, ...rest }: TableFilterIndicatorProps) {
  const ctx = useTable("FilterIndicator")
  const f = useFilter("FilterIndicator")
  const own = f.active ? (active ?? children) : children
  const shown = useIconChildren(f.active ? "funnel" : "funnel-simple", own)
  return renderPart(
    "span",
    { ...mergeProps(normalizeProps(ctx.api.filterIndicator(f.active)), rest), children: shown },
    render,
    ctx.state,
  )
}

export type TableEmptyProps = PartProps<"tr"> & {
  /** The cell's span; default: the leaf columns counted after mount (one on the server). */
  readonly colSpan?: number
}

function Empty({ render, colSpan, children, ref, ...rest }: TableEmptyProps) {
  const ctx = useTable("Empty")
  const row = useRef<HTMLTableRowElement | null>(null)
  const [counted, setCounted] = useState<number | undefined>(undefined)
  const { setEmpty } = ctx
  useIsoLayoutEffect(() => {
    setEmpty(1)
    return () => setEmpty(-1)
  }, [setEmpty])
  useIsoLayoutEffect(() => {
    if (colSpan !== undefined) return
    const table = row.current?.closest("table")
    const last = table?.tHead?.rows[(table.tHead?.rows.length ?? 1) - 1]
    if (!last) return
    let n = 0
    for (const cell of Array.from(last.cells)) n += cell.colSpan || 1
    setCounted(n)
  })
  const props = mergeProps(normalizeProps(ctx.api.empty()), { ref: composeRefs(row, ref) }, rest)
  return renderPart(
    "tr",
    { ...props, children: <td colSpan={colSpan ?? counted}>{children}</td> },
    render,
    ctx.state,
  )
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
