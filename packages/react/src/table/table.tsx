import {
  type ChangeDetails,
  domTableMetrics,
  itemId,
  type MessageOverrides,
  quirkActive,
  type SortDescriptor,
  type SortDirection,
  type TableEvent,
  type TableMessages,
  type TableSortValue,
  tableConnect,
  tableMachine,
  tableMessages,
  visibleText,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
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
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: TableRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
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
    },
    tableEnv,
  )
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
    captionId,
    tableLabel: tableLabel.current,
    describeSort: mounted && quirkActive("talkback-aria-sort", env),
  })
  const ctx: Ctx = {
    api,
    send,
    state,
    instance,
    captionId: `table-${instance}-caption`,
    registry,
    captioned: captionId !== undefined,
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
    const t = el.current
    if (!t || t.caption || t.hasAttribute("aria-label") || t.hasAttribute("aria-labelledby")) return
    warnOnce(ctx.instance, "a table needs a name: render Table.Caption or pass aria-label")
  })
  return renderPart(
    "table",
    mergeProps(normalizeProps(ctx.api.table({ loading })), { ref: composeRefs(el, ref) }, rest),
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

function Row({ render, ...rest }: PartProps<"tr">) {
  const ctx = useTable("Row")
  return renderPart("tr", mergeProps(normalizeProps(ctx.api.row()), rest), render, ctx.state)
}

export type TableColumnHeaderProps = PartProps<"th"> & {
  /** Holds a SortTrigger; needs `id`. */
  readonly sortable?: boolean
  /** The column id: unique in the table, what `sort.column` holds. */
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
  ...rest
}: TableColumnHeaderProps) {
  const ctx = useTable("ColumnHeader")
  if (sortable && (id === undefined || id === "")) {
    throw new Error("Table.ColumnHeader: a sortable column needs a non-empty `id`")
  }
  const column = sortable ? id : undefined
  useIsoLayoutEffect(() => {
    if (column === undefined) return
    if (process.env.NODE_ENV !== "production" && ctx.columns.has(column)) {
      console.error(`[rind-ui] table: two sortable columns have the id "${column}"`)
    }
    ctx.columns.add(column)
    return () => {
      ctx.columns.delete(column)
    }
  }, [column, ctx.columns])
  const api = normalizeProps(ctx.api.columnHeader({ colSpan, sortable: column }))
  const domId = id === undefined ? undefined : itemId("table", ctx.instance, "column", id)
  const props = mergeProps(api, { colSpan, ...(domId ? { id: domId } : {}) }, rest)
  const th = renderPart("th", props, render, ctx.state)
  return column === undefined ? (
    th
  ) : (
    <ColumnContext value={{ id: column, firstDirection }}>{th}</ColumnContext>
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
  if (!column) throw new Error("Table.SortTrigger must be inside a sortable Table.ColumnHeader")
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

function SortIndicator({ render, ...rest }: PartProps<"span">) {
  const ctx = useTable("SortIndicator")
  const column = useContext(ColumnContext)
  if (!column) throw new Error("Table.SortIndicator must be inside a sortable Table.ColumnHeader")
  return renderPart(
    "span",
    mergeProps(normalizeProps(ctx.api.sortIndicator(column.id)), rest),
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

export const Table = {
  Root,
  Table: TableElement,
  Caption,
  Head,
  Body,
  Foot,
  Row,
  ColumnHeader,
  RowHeader,
  Cell,
  SortTrigger,
  SortIndicator,
  Empty,
}
