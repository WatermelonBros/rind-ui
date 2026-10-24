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
  type ComputedRef,
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { changeEmitter } from "../emit-change"
import { useIconChildren } from "../icons"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import * as Popover from "../popover/popover.parts"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
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

/** What every part's slot receives. */
export interface TableRenderState {
  readonly sort: SortDescriptor | null
  readonly scrollStop: boolean
}

export interface TableFrameRenderState {
  readonly expanded: boolean
}

type Api = ReturnType<typeof tableConnect>
type FrameApi = ReturnType<typeof tableFrameConnect>

interface FrameCtx {
  readonly instance: () => string
  readonly api: () => FrameApi
  readonly send: (event: TableFrameEvent) => void
  readonly expanded: () => boolean
  readonly caption: ShallowRef<string | undefined>
  /** The Title's id: names the table and the full-page view when there is no Caption. */
  readonly title: ShallowRef<string | undefined>
}
const FrameKey: InjectionKey<FrameCtx> = Symbol("rind-ui.table-frame")
function useFrame(part: string): FrameCtx {
  const ctx = inject(FrameKey, null)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Frame`)
  return ctx
}

interface Ctx {
  readonly api: () => Api
  readonly send: (event: TableEvent) => void
  readonly state: () => TableRenderState
  readonly instance: () => string
  readonly registry: ReturnType<typeof usePartRegistry<"caption">>
  readonly captioned: () => boolean
  /** The Frame around the Root, when there is one (the Caption names it while expanded). */
  readonly frame: FrameCtx | null
  /** Column ids, for the duplicate check. */
  readonly columns: Set<string>
  readonly setEmpty: (delta: 1 | -1) => void
  readonly tableLabel: { current: string | undefined }
}
const TableKey: InjectionKey<Ctx> = Symbol("rind-ui.table")
function useTable(part: string): Ctx {
  const ctx = inject(TableKey, null)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Root`)
  return ctx
}

interface RowCtx {
  readonly id: () => string | undefined
  /** The RowHeader's text (measured after mount; the id until then). */
  readonly text: () => string | undefined
}
const RowKey: InjectionKey<RowCtx> = Symbol("rind-ui.table-row")

interface ColumnCtx {
  readonly id: () => string | undefined
  readonly firstDirection: () => SortDirection
  readonly sortable: () => boolean
  /** The column's text (measured after mount; the id until then). */
  readonly text: () => string
  /** A Filter registers while mounted. */
  readonly addFilter: () => () => void
}
const ColumnKey: InjectionKey<ColumnCtx> = Symbol("rind-ui.table-column")

interface FilterCtx {
  readonly column: ColumnCtx
  readonly active: () => boolean
}
const FilterKey: InjectionKey<FilterCtx> = Symbol("rind-ui.table-filter")
function useFilter(part: string): FilterCtx {
  const ctx = inject(FilterKey, null)
  if (!ctx) throw new Error(`Table.${part} must be inside Table.Filter`)
  return ctx
}

const box = (value: SortDescriptor | null): TableSortValue => ({ value })

type Slots<S = TableRenderState> = SlotsType<{ default?: (state: S) => VNodeChild }>

/** Focus and modality of a button part. Call in setup. */
function useFocus() {
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the button is mounted.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return {
    env,
    focused,
    modality,
    handlers: {
      onFocus: () => (focused.value = true),
      onBlur: () => (focused.value = false),
    },
  }
}

/** The leaf columns' count, read from the head after mount (Empty, RowDetails). */
function useLeafColumns(row: ShallowRef<Element | null>, given: () => number | undefined) {
  const counted = shallowRef<number | undefined>(undefined)
  const count = () => {
    if (given() !== undefined) return
    const table = row.value?.closest("table")
    const last = table?.tHead?.rows[(table.tHead?.rows.length ?? 1) - 1]
    if (!last) return
    let n = 0
    for (const cell of Array.from(last.cells)) n += cell.colSpan || 1
    if (n !== counted.value) counted.value = n
  }
  onMounted(count)
  onUpdated(count)
  return () => given() ?? counted.value
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

const Root = defineComponent({
  name: "TableRoot",
  inheritAttrs: false,
  props: {
    /** Controlled sort (`v-model:sort`); `null` is controlled and unsorted. The Table never reorders rows. */
    sort: { type: Object as PropType<SortDescriptor | null>, default: undefined },
    defaultSort: { type: Object as PropType<SortDescriptor | null>, default: undefined },
    /** A press on the sorted column at the opposite of its first direction clears the sort. */
    allowUnsorted: { type: Boolean, default: undefined },
    /** `data-sticky-first-column` on the Root (the theme pins the first cell of each row). */
    stickyFirstColumn: Boolean,
    /** Column ids pinned at the inline start and end (`v-model:pinnedColumns`). */
    pinnedColumns: Object as PropType<PinnedColumns>,
    defaultPinnedColumns: Object as PropType<PinnedColumns>,
    /** Row ids whose details are open (`v-model:expandedRows`). */
    expandedRows: Array as PropType<readonly string[]>,
    defaultExpandedRows: Array as PropType<readonly string[]>,
    /** Several rows open at once (default); `false`: opening one closes the others. */
    multiple: { type: Boolean, default: undefined },
    /** The rows shown (after filters): announced when it changes. */
    rowCount: Number,
    /** With pagination: the rows shown of the total, announced instead of the count. */
    rowRange: Object as PropType<RowRange>,
    messages: Object as PropType<MessageOverrides<TableMessages>>,
    /** Default: the provider's locale (the announcement's language). */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** A press proposes the next sort; `details.event.column`, `details.cancel()`. */
    sortChange: (_sort: SortDescriptor | null, _details: ChangeDetails<TableEvent>) => true,
    "update:sort": (_sort: SortDescriptor | null) => true,
    pinnedColumnsChange: (_pinned: PinnedColumns, _details: ChangeDetails<TableEvent>) => true,
    "update:pinnedColumns": (_pinned: PinnedColumns) => true,
    expandedRowsChange: (_rows: readonly string[], _details: ChangeDetails<TableEvent>) => true,
    "update:expandedRows": (_rows: readonly string[]) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    // Inside a Frame the Root shares its instance: every part of the table is one instance.
    const frame = inject(FrameKey, null)
    const instance = useRootId(() => props.id ?? frame?.instance())
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("table", tableMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const registry = usePartRegistry<"caption">({ scope: "table", root: instance() })
    const tableEnv = { ...env, tableMetrics: domTableMetrics(env) }
    // One box per descriptor: the machine compares by content.
    const controlled = computed(() => (props.sort === undefined ? undefined : box(props.sort)))
    const initial = props.defaultSort === undefined ? undefined : box(props.defaultSort)
    const onSortChange = changeEmitter<TableSortValue, TableEvent>(
      (v, d) => emit("sortChange", v.value, d),
      (v) => emit("update:sort", v.value),
    )
    const onPinnedColumnsChange = changeEmitter<PinnedColumns, TableEvent>(
      (v, d) => emit("pinnedColumnsChange", v, d),
      (v) => emit("update:pinnedColumns", v),
    )
    const onExpandedRowsChange = changeEmitter<readonly string[], TableEvent>(
      (v, d) => emit("expandedRowsChange", v, d),
      (v) => emit("update:expandedRows", v),
    )
    const { view, send } = useMachine(
      tableMachine,
      () => ({
        root: instance(),
        messages: messages.value,
        lang: locale.value.locale,
        sort: controlled.value,
        defaultSort: initial,
        onSortChange,
        allowUnsorted: props.allowUnsorted,
        pinnedColumns: props.pinnedColumns,
        defaultPinnedColumns: props.defaultPinnedColumns,
        onPinnedColumnsChange,
        rowCount: props.rowCount,
        rowRange: props.rowRange,
        expandedRows: props.expandedRows,
        defaultExpandedRows: props.defaultExpandedRows,
        onExpandedRowsChange,
        multiple: props.multiple,
      }),
      tableEnv,
    )
    const mounted = shallowRef(false)
    onMounted(() => (mounted.value = true))
    const emptyCount = shallowRef(0)
    const columns = new Set<string>()
    const tableLabel = { current: undefined as string | undefined }
    const captionId = useRenderedId(registry, "caption")
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const state = computed(
      (): TableRenderState => ({
        sort: view.value.values.sort.value,
        scrollStop: view.value.context.tabStop,
      }),
    )
    const api = computed(() => {
      const c = view.value.context
      return tableConnect({
        instance: instance(),
        sort: view.value.values.sort.value,
        messages: messages.value,
        tabStop: c.tabStop,
        holdsControls: c.measured && (c.overflow.x || c.overflow.y) && c.tabbableContent,
        overflow: c.overflow,
        edges: c.edges,
        focused: focused.value,
        modality: modality.value,
        stickyFirstColumn: props.stickyFirstColumn,
        empty: emptyCount.value > 0,
        captionId: captionId.value ?? frame?.title.value,
        tableLabel: tableLabel.current,
        describeSort: mounted.value && quirkActive("talkback-aria-sort", env),
        pinned: view.value.values.pinnedColumns,
        expandedRows: view.value.values.expandedRows,
      })
    })
    provide(TableKey, {
      api: () => api.value,
      send,
      state: () => state.value,
      instance,
      registry,
      captioned: () => captionId.value !== undefined,
      frame,
      columns,
      setEmpty: (d) => (emptyCount.value += d),
      tableLabel,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(api.value.root()), {
              onFocus: (e: FocusEvent) => {
                if (e.target !== e.currentTarget) return
                focused.value = true
                send({ type: "ROOT.FOCUS" })
              },
              onBlur: (e: FocusEvent) => {
                if (e.target !== e.currentTarget) return
                focused.value = false
                send({ type: "ROOT.BLUR" })
              },
            }),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(state.value),
        props.asChild,
      )
  },
})

const TableElement = defineComponent({
  name: "TableTable",
  inheritAttrs: false,
  props: {
    /** `aria-busy="true"` and `data-loading`. */
    loading: Boolean,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("Table")
    const el = shallowRef<Element | null>(null)
    // After commit: the Caption, or a label, names the table (spec "Name").
    const check = () => {
      if (process.env.NODE_ENV === "production") return
      // After the re-render a Caption or a Title causes when it registers.
      queueMicrotask(() => {
        const t = el.value
        if (!(t instanceof HTMLTableElement) || !t.isConnected) return
        if (t.caption || t.hasAttribute("aria-label") || t.hasAttribute("aria-labelledby")) return
        warnOnce(
          ctx.instance(),
          "a table needs a name: render Table.Caption, Table.Title or aria-label",
        )
      })
    }
    onMounted(check)
    onUpdated(check)
    return () => {
      ctx.tableLabel.current = attrs["aria-label"] as string | undefined
      // No Caption and no label of its own: the Frame's Title names it.
      const titled =
        !ctx.captioned() &&
        attrs["aria-label"] === undefined &&
        attrs["aria-labelledby"] === undefined &&
        ctx.frame?.title.value !== undefined
      return renderPart(
        "table",
        mergeProps(
          normalizeProps(ctx.api().table({ loading: props.loading })),
          {
            ref: refTo(el),
            ...(titled ? { "aria-labelledby": ctx.frame?.title.value } : {}),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

const Caption = defineComponent({
  name: "TableCaption",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("Caption")
    const own = () => props.id ?? `table-${ctx.instance()}-caption`
    useRegisterPart(ctx.registry, "caption", own)
    const frame = ctx.frame
    if (frame) {
      onMounted(() =>
        watch(own, (id) => (frame.caption.value = id), { immediate: true, flush: "sync" }),
      )
      onBeforeUnmount(() => (frame.caption.value = undefined))
    }
    return () =>
      renderPart(
        "caption",
        mergeProps(normalizeProps(ctx.api().caption(own())), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** A part with no state of its own: connect's props for the tag, the slot's content. */
function simplePart(name: string, tag: string, pick: (api: Api) => Record<string, unknown>) {
  return defineComponent({
    name: `Table${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useTable(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(pick(ctx.api()) as never), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

const Head = simplePart("Head", "thead", (api) => api.head())
const Body = simplePart("Body", "tbody", (api) => api.body())
const Foot = simplePart("Foot", "tfoot", (api) => api.foot())
const Cell = simplePart("Cell", "td", (api) => api.cell())

const Row = defineComponent({
  name: "TableRow",
  inheritAttrs: false,
  props: {
    /** The row id: needed to expand it (`expandedRows`, RowTrigger, RowDetails). */
    id: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("Row")
    const el = shallowRef<Element | null>(null)
    const text = shallowRef<string | undefined>(undefined)
    const measure = () => {
      if (props.id === undefined) return
      const header = el.value?.querySelector<HTMLElement>(':scope > [data-part="row-header"]')
      const next = header ? visibleText(header) : undefined
      if (next !== text.value) text.value = next
    }
    onMounted(measure)
    onUpdated(measure)
    provide(RowKey, { id: () => props.id, text: () => text.value ?? props.id })
    return () => {
      const domId =
        props.id === undefined ? undefined : itemId("table", ctx.instance(), "row", props.id)
      return renderPart(
        "tr",
        mergeProps(
          normalizeProps(ctx.api().row(props.id)),
          { ref: refTo(el), ...(domId ? { id: domId } : {}) },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

const RowTrigger = defineComponent({
  name: "TableRowTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("RowTrigger")
    const row = inject(RowKey, null)
    if (!row || row.id() === undefined) {
      throw new Error("Table.RowTrigger must be inside a Table.Row with an `id`")
    }
    const f = useFocus()
    return () => {
      const id = row.id() as string
      const named = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      const own = normalizeProps(
        ctx.api().rowTrigger(id, {
          text: row.text() ?? id,
          named,
          focused: f.focused.value,
          modality: f.modality.value,
        }),
      )
      const merged = mergeProps(
        joinHandlers(own, f.handlers, {
          onClick: () => ctx.send({ type: "ROW.TOGGLE", row: id }),
        }),
        attrs,
      )
      return renderPart("button", merged, slots.default?.(ctx.state()), props.asChild)
    }
  },
})

const RowDetails = defineComponent({
  name: "TableRowDetails",
  inheritAttrs: false,
  props: {
    /** The id of the Row these details belong to (render it right after that Row). */
    rowId: { type: String, required: true },
    /** The cell's span; default: the leaf columns counted after mount. */
    colSpan: Number,
    /** Props of the one cell spanning the row. */
    cellProps: Object as PropType<Record<string, unknown>>,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("RowDetails")
    const row = shallowRef<Element | null>(null)
    const span = useLeafColumns(row, () => props.colSpan)
    return () =>
      renderPart(
        "tr",
        mergeProps(normalizeProps(ctx.api().rowDetails(props.rowId)), { ref: refTo(row) }, attrs),
        h("td", { colspan: span(), ...props.cellProps }, slots.default?.(ctx.state()) as never),
        props.asChild,
      )
  },
})

const ColumnHeader = defineComponent({
  name: "TableColumnHeader",
  inheritAttrs: false,
  props: {
    /** Holds a SortTrigger; needs `id`. */
    sortable: Boolean,
    /** The column id: unique in the table, what `sort.column` and `pinnedColumns` hold. */
    id: String,
    /** The direction of a first press on this column. Default `ascending`. */
    firstDirection: { type: String as PropType<SortDirection>, default: "ascending" },
    colSpan: Number,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("ColumnHeader")
    if (props.sortable && (props.id === undefined || props.id === "")) {
      throw new Error("Table.ColumnHeader: a sortable column needs a non-empty `id`")
    }
    onMounted(() =>
      watch(
        () => props.id,
        (id, _, onCleanup) => {
          if (id === undefined) return
          if (process.env.NODE_ENV !== "production" && ctx.columns.has(id)) {
            console.error(`[rind-ui] table: two columns have the id "${id}"`)
          }
          ctx.columns.add(id)
          onCleanup(() => ctx.columns.delete(id))
        },
        { immediate: true },
      ),
    )
    // A Filter inside: the header is named by its text alone (MUI-X#19239); the text is read
    // after mount, without the filter's own button.
    const el = shallowRef<Element | null>(null)
    const filters = shallowRef(0)
    const text = shallowRef<string | undefined>(undefined)
    const measure = () => {
      const th = el.value
      if (!th || filters.value === 0) return
      const copy = th.cloneNode(true) as HTMLElement
      for (const n of Array.from(copy.querySelectorAll('[data-part="filter-trigger"]'))) n.remove()
      const next = visibleText(copy)
      if (next !== text.value) text.value = next
    }
    onMounted(measure)
    onUpdated(measure)
    provide(ColumnKey, {
      id: () => props.id,
      firstDirection: () => props.firstDirection,
      sortable: () => props.sortable,
      text: () => text.value ?? props.id ?? "",
      addFilter: () => {
        filters.value++
        return () => filters.value--
      },
    })
    return () => {
      const own = normalizeProps(
        ctx.api().columnHeader({
          colSpan: props.colSpan,
          column: props.id,
          sortable: props.sortable,
          controls: filters.value > 0,
          text: text.value,
        }),
      )
      const domId =
        props.id === undefined ? undefined : itemId("table", ctx.instance(), "column", props.id)
      return renderPart(
        "th",
        mergeProps(
          own,
          { colspan: props.colSpan, ref: refTo(el), ...(domId ? { id: domId } : {}) },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

const RowHeader = defineComponent({
  name: "TableRowHeader",
  inheritAttrs: false,
  props: { rowSpan: Number, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("RowHeader")
    return () =>
      renderPart(
        "th",
        mergeProps(
          normalizeProps(ctx.api().rowHeader({ rowSpan: props.rowSpan })),
          { rowspan: props.rowSpan },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The column a sort part sits in; throws outside a sortable ColumnHeader. */
function useSortColumn(part: string): Omit<ColumnCtx, "id"> & { readonly id: () => string } {
  const column = inject(ColumnKey, null)
  if (!column?.sortable()) {
    throw new Error(`Table.${part} must be inside a sortable Table.ColumnHeader`)
  }
  // A sortable column has an id (the ColumnHeader throws otherwise).
  return { ...column, id: () => column.id() as string }
}

const SortTrigger = defineComponent({
  name: "TableSortTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("SortTrigger")
    const column = useSortColumn("SortTrigger")
    const f = useFocus()
    return () => {
      const id = column.id()
      const state = ctx.api().sortState(id)
      const own = normalizeProps(
        ctx.api().sortTrigger(id, { focused: f.focused.value, modality: f.modality.value }),
      )
      const merged = mergeProps(
        joinHandlers(own, f.handlers, {
          // A native button: pointer, Enter, Space and an assistive technology's bare click.
          onClick: (e: MouseEvent) =>
            ctx.send({
              type: "SORT",
              column: id,
              name: visibleText(e.currentTarget as HTMLElement),
              firstDirection: column.firstDirection(),
              modality: f.env.modality.modality(),
            }),
        }),
        attrs,
      )
      return renderPart(
        "button",
        merged,
        [
          slots.default?.(ctx.state()),
          // Hidden from the name (aria-hidden); still read as the description.
          state
            ? h(VisuallyHidden, { id: state.id, "aria-hidden": "true" }, () => state.text)
            : null,
        ],
        props.asChild,
      )
    }
  },
})

const SortIndicator = defineComponent({
  name: "TableSortIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    default?: (state: TableRenderState) => VNodeChild
    /** Rendered while sorted ascending (else the default slot). */
    ascending?: () => VNodeChild
    /** Rendered while sorted descending (else the default slot). */
    descending?: () => VNodeChild
    /** Rendered while not sorted (else the default slot). */
    none?: () => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const ctx = useTable("SortIndicator")
    const column = useSortColumn("SortIndicator")
    // Else the provider's icon for the direction; else nothing (the theme draws the shape).
    const up = useIconChildren("caret-up")
    const down = useIconChildren("caret-down")
    const both = useIconChildren("caret-up-down")
    return () => {
      const sort = ctx.state().sort
      const direction = sort && sort.column === column.id() ? sort.direction : "none"
      const slot = slots[direction] ?? slots.default
      const own = slot?.(ctx.state())
      const shown =
        direction === "ascending" ? up(own) : direction === "descending" ? down(own) : both(own)
      return renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().sortIndicator(column.id())), attrs),
        shown,
        props.asChild,
      )
    }
  },
})

// ── Frame, Header, Footer and the full-page view (table-columns-and-toolbar design §4) ──

type FrameSlots = SlotsType<{ default?: (state: TableFrameRenderState) => VNodeChild }>

const Frame = defineComponent({
  name: "TableFrame",
  inheritAttrs: false,
  props: {
    /** Full page: the Frame covers the viewport as a modal dialog (`v-model:expanded`). */
    expanded: { type: Boolean, default: undefined },
    defaultExpanded: { type: Boolean, default: undefined },
    /** Overrides the strings ("Full page"); also through the provider. */
    messages: Object as PropType<MessageOverrides<TableMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    expandedChange: (_expanded: boolean, _details: ChangeDetails<TableFrameEvent>) => true,
    "update:expanded": (_expanded: boolean) => true,
  },
  slots: Object as FrameSlots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("table", tableMessages, () => props.messages)
    const env = useEnvironment()
    const onExpandedChange = changeEmitter<boolean, TableFrameEvent>(
      (v, d) => emit("expandedChange", v, d),
      (v) => emit("update:expanded", v),
    )
    const { view, send } = useMachine(
      tableFrameMachine,
      () => ({
        root: instance(),
        expanded: props.expanded,
        defaultExpanded: props.defaultExpanded,
        onExpandedChange,
      }),
      env,
    )
    const caption = shallowRef<string | undefined>(undefined)
    const title = shallowRef<string | undefined>(undefined)
    const expanded = () => view.value.values.expanded
    const api: ComputedRef<FrameApi> = computed(() =>
      tableFrameConnect({
        instance: instance(),
        expanded: expanded(),
        messages: messages.value,
        captionId: caption.value ?? title.value,
        ids: tableFrameIds(instance()),
      }),
    )
    provide(FrameKey, { instance, api: () => api.value, send, expanded, caption, title })
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api.value.frame()), attrs),
        slots.default?.({ expanded: expanded() }),
        props.asChild,
      )
  },
})

function framePart(name: string, pick: (api: FrameApi) => Record<string, unknown>) {
  return defineComponent({
    name: `Table${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as FrameSlots,
    setup(props, { attrs, slots }) {
      const f = useFrame(name)
      return () =>
        renderPart(
          "div",
          mergeProps(normalizeProps(pick(f.api()) as never), attrs),
          slots.default?.({ expanded: f.expanded() }),
          props.asChild,
        )
    },
  })
}

const Header = framePart("Header", (api) => api.header())
const Footer = framePart("Footer", (api) => api.footer())

const Title = defineComponent({
  name: "TableTitle",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as FrameSlots,
  setup(props, { attrs, slots }) {
    const f = useFrame("Title")
    const own = () => props.id ?? `table-${f.instance()}-title`
    onMounted(() => watch(own, (id) => (f.title.value = id), { immediate: true, flush: "sync" }))
    onBeforeUnmount(() => (f.title.value = undefined))
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(f.api().title(own())), attrs),
        slots.default?.({ expanded: f.expanded() }),
        props.asChild,
      )
  },
})

const ExpandTrigger = defineComponent({
  name: "TableExpandTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    default?: (state: TableFrameRenderState) => VNodeChild
    /** Rendered while full page (else the default slot). */
    expanded?: () => VNodeChild
    /** Rendered while in place (else the default slot). */
    collapsed?: () => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const f = useFrame("ExpandTrigger")
    const focus = useFocus()
    const arrowsIn = useIconChildren("arrows-in")
    const arrowsOut = useIconChildren("arrows-out")
    return () => {
      const expanded = f.expanded()
      const slot = (expanded ? slots.expanded : slots.collapsed) ?? slots.default
      const own = slot?.({ expanded })
      const named = slots.default !== undefined
      const shown = expanded ? arrowsIn(own) : arrowsOut(own)
      const merged = mergeProps(
        joinHandlers(
          normalizeProps(
            f.api().expandTrigger({
              named,
              focused: focus.focused.value,
              modality: focus.modality.value,
            }),
          ),
          focus.handlers,
          { onClick: () => f.send({ type: "TOGGLE" }) },
        ),
        attrs,
      )
      return renderPart("button", merged, shown, props.asChild)
    }
  },
})

// ── Filters: a Popover scoped to the table, inside a ColumnHeader (design §2) ──

const Filter = defineComponent({
  name: "TableFilter",
  inheritAttrs: false,
  props: {
    /** The column is filtered: the trigger is marked and described "Filtered". */
    active: Boolean,
    /** Controlled open state of the filter popover (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    /** Uncontrolled initial open state. */
    defaultOpen: { type: Boolean, default: undefined },
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const column = inject(ColumnKey, null)
    if (!column || column.id() === undefined) {
      throw new Error("Table.Filter must be inside a Table.ColumnHeader with an `id`")
    }
    onMounted(() => onBeforeUnmount(column.addFilter()))
    provide(FilterKey, { column, active: () => props.active })
    return () =>
      h(
        Popover.Root,
        // Popover.Root's own props, with the listeners (openChange, update:open) in attrs.
        { scope: "table", open: props.open, defaultOpen: props.defaultOpen, ...attrs } as never,
        slots,
      )
  },
})

const FilterTrigger = defineComponent({
  name: "TableFilterTrigger",
  inheritAttrs: false,
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(_, { attrs, slots }) {
    const ctx = useTable("FilterTrigger")
    const f = useFilter("FilterTrigger")
    return () => {
      const id = f.column.id() as string
      const named = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      const own = normalizeProps(
        ctx.api().filterTrigger(id, { text: f.column.text(), active: f.active(), named }),
      )
      const state = ctx.api().filterState(id, f.active())
      return h(Popover.Trigger, mergeProps(own, attrs), () => [
        slots.default?.(),
        state ? h(VisuallyHidden, { id: state.id, "aria-hidden": "true" }, () => state.text) : null,
      ])
    }
  },
})

const FilterContent = defineComponent({
  name: "TableFilterContent",
  inheritAttrs: false,
  props: {
    /** Props of the Positioner around the content. */
    positionerProps: Object as PropType<Record<string, unknown>>,
  },
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = useTable("FilterContent")
    const f = useFilter("FilterContent")
    return () => {
      const label = ctx.api().filterTrigger(f.column.id() as string, {
        text: f.column.text(),
        active: false,
        named: false,
      })["aria-label"] as string
      return h(Popover.Portal, null, () =>
        h(Popover.Positioner, { "data-part": "filter-positioner", ...props.positionerProps }, () =>
          h(
            Popover.Content,
            { "data-part": "filter-content", "aria-label": label, ...attrs },
            slots,
          ),
        ),
      )
    }
  },
})

const FilterIndicator = defineComponent({
  name: "TableFilterIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{
    default?: (state: TableRenderState) => VNodeChild
    /** Rendered while the column is filtered (else the default slot). */
    active?: () => VNodeChild
  }>,
  setup(props, { attrs, slots }) {
    const ctx = useTable("FilterIndicator")
    const f = useFilter("FilterIndicator")
    const funnel = useIconChildren("funnel")
    const simple = useIconChildren("funnel-simple")
    return () => {
      const active = f.active()
      const own = ((active ? slots.active : undefined) ?? slots.default)?.(ctx.state())
      return renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().filterIndicator(active)), attrs),
        active ? funnel(own) : simple(own),
        props.asChild,
      )
    }
  },
})

const Empty = defineComponent({
  name: "TableEmpty",
  inheritAttrs: false,
  props: {
    /** The cell's span; default: the leaf columns counted after mount (one on the server). */
    colSpan: Number,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTable("Empty")
    const row = shallowRef<Element | null>(null)
    onMounted(() => ctx.setEmpty(1))
    onBeforeUnmount(() => ctx.setEmpty(-1))
    const span = useLeafColumns(row, () => props.colSpan)
    return () =>
      renderPart(
        "tr",
        mergeProps(normalizeProps(ctx.api().empty()), { ref: refTo(row) }, attrs),
        h("td", { colspan: span() }, slots.default?.(ctx.state()) as never),
        props.asChild,
      )
  },
})

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
