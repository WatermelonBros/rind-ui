import { NgComponentOutlet } from "@angular/common"
import {
  ApplicationRef,
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  isDevMode,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  type Type,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  domTableMetrics,
  itemId,
  type MessageOverrides,
  type PartProps,
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
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectRendered } from "../layer-context"
import {
  POPOVER_SCOPE,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
} from "../popover/popover"
import {
  injectEnvironment,
  injectIcon,
  injectLocale,
  injectMessages,
  withCapabilities,
} from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { VisuallyHidden } from "../visually-hidden/visually-hidden"

/** What the parts' templates read (`#t="rindTableRoot"`, `t.state()`). */
export interface TableRenderState {
  readonly sort: SortDescriptor | null
  readonly scrollStop: boolean
}

export interface TableFrameRenderState {
  readonly expanded: boolean
}

type Api = ReturnType<typeof tableConnect>
type FrameApi = ReturnType<typeof tableFrameConnect>

const FRAME = new InjectionToken<TableFrame>("rind-ui.table-frame")
const TABLE = new InjectionToken<TableRoot>("rind-ui.table")
const ROW = new InjectionToken<TableRow>("rind-ui.table-row")
const COLUMN = new InjectionToken<TableColumnHeader>("rind-ui.table-column")
const FILTER = new InjectionToken<TableFilter>("rind-ui.table-filter")

function injectTable(part: string): TableRoot {
  const root = inject(TABLE, { optional: true })
  if (!root) throw new Error(`rindTable${part} must be inside rindTableRoot`)
  return root
}

function injectFrame(part: string): TableFrame {
  const frame = inject(FRAME, { optional: true })
  if (!frame) throw new Error(`rindTable${part} must be inside rindTableFrame`)
  return frame
}

function injectFilter(part: string): TableFilter {
  const filter = inject(FILTER, { optional: true })
  if (!filter) throw new Error(`rindTable${part} must be inside rindTableFilter`)
  return filter
}

const box = (value: SortDescriptor | null): TableSortValue => ({ value })
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/** Focus and modality of a button part. Call it in a constructor. */
function injectFocus() {
  const env = injectEnvironment()
  // The modality tracker needs a subscriber while the button is rendered.
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  return {
    env,
    focused,
    modality,
    handlers: { onFocus: () => focused.set(true), onBlur: () => focused.set(false) },
  }
}

/** The leaf columns' count, read from the head after render (Empty, RowDetails). */
function injectLeafColumns(given: () => number | undefined): Signal<number | undefined> {
  const counted = signal<number | undefined>(undefined)
  if (inject(PLATFORM_ID) !== "browser") return counted
  const row: Element = inject(ElementRef).nativeElement
  afterEveryRender({
    read: () => {
      if (untracked(given) !== undefined) return
      const table = row.closest("table")
      const last = table?.tHead?.rows[(table.tHead?.rows.length ?? 1) - 1]
      if (!last) return
      let n = 0
      for (const cell of Array.from(last.cells)) n += cell.colSpan || 1
      if (n !== untracked(counted)) counted.set(n)
    },
  })
  return counted
}

const warned = new Set<string>()
function warnOnce(instance: string, message: string) {
  const key = `${instance}:${message}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[rind-ui] table: ${message}`)
}

/**
 * A data table: `<div rindTableRoot>` around a `<table rindTableTable>`. It sorts, pins and
 * expands by state only; the consumer orders and filters the rows.
 */
@Directive({
  selector: "[rindTableRoot]",
  exportAs: "rindTableRoot",
  providers: [{ provide: TABLE, useExisting: forwardRef(() => TableRoot) }],
})
export class TableRoot {
  /** Controlled sort (`[(sort)]`); `null` is controlled and unsorted. The Table never reorders rows. */
  readonly sort = input<SortDescriptor | null>()
  readonly defaultSort = input<SortDescriptor | null>()
  /** A press on the sorted column at the opposite of its first direction clears the sort. */
  readonly allowUnsorted = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** `data-sticky-first-column` on the Root (the theme pins the first cell of each row). */
  readonly stickyFirstColumn = input(false, { transform: booleanAttribute })
  /** Column ids pinned at the inline start and end (`[(pinnedColumns)]`). */
  readonly pinnedColumns = input<PinnedColumns>()
  readonly defaultPinnedColumns = input<PinnedColumns>()
  /** Row ids whose details are open (`[(expandedRows)]`). */
  readonly expandedRows = input<readonly string[]>()
  readonly defaultExpandedRows = input<readonly string[]>()
  /** Several rows open at once (default); `false`: opening one closes the others. */
  readonly multiple = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** The rows shown (after filters): announced when it changes. */
  readonly rowCount = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** With pagination: the rows shown of the total, announced instead of the count. */
  readonly rowRange = input<RowRange>()
  readonly messages = input<MessageOverrides<TableMessages>>()
  /** Default: the provider's locale (the announcement's language). */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** A press proposes the next sort; `details.event.column`, `details.cancel()`. */
  readonly sortChangeDetails = output<ChangeEvent<SortDescriptor | null, TableEvent>>()
  readonly sortChange = output<SortDescriptor | null>()
  readonly pinnedColumnsChangeDetails = output<ChangeEvent<PinnedColumns, TableEvent>>()
  readonly pinnedColumnsChange = output<PinnedColumns>()
  readonly expandedRowsChangeDetails = output<ChangeEvent<readonly string[], TableEvent>>()
  readonly expandedRowsChange = output<readonly string[]>()

  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly send: (event: TableEvent) => void
  /** The table's state, for the template. */
  readonly state: Signal<TableRenderState>
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"caption">>
  /** @internal */
  readonly captioned: Signal<boolean>
  /** @internal The Frame around the Root, when there is one (the Caption names it while expanded). */
  readonly frame = inject(FRAME, { optional: true })
  /** @internal Column ids, for the duplicate check. */
  readonly columns = new Set<string>()
  /** @internal */
  readonly emptyCount = signal(0)
  /** @internal The Table's own aria-label. */
  readonly tableLabel = signal<string | undefined>(undefined)

  constructor() {
    // Inside a Frame the Root shares its instance: every part of the table is one instance.
    const frame = this.frame
    const instance = injectRootId(() => this.id() ?? frame?.instance())
    this.instance = instance
    const env = injectEnvironment(announcerCapability)
    const texts = injectMessages("table", tableMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    this.registry = injectPartRegistry<"caption">(() => ({ scope: "table", root: instance() }))
    const tableEnv = withCapabilities(env, { tableMetrics: domTableMetrics(env) })
    // One box per descriptor: the machine compares by content.
    const controlled = computed(() => {
      const sort = this.sort()
      return sort === undefined ? undefined : box(sort)
    })
    const initial = computed(() => {
      const sort = this.defaultSort()
      return sort === undefined ? undefined : box(sort)
    })
    const sortDetails = changeEmitter<SortDescriptor | null, TableEvent>(
      this.sortChangeDetails,
      this.sortChange,
    )
    const onSortChange = (v: TableSortValue, d: Parameters<typeof sortDetails>[1]) =>
      sortDetails(v.value, d)
    const onPinnedColumnsChange = changeEmitter<PinnedColumns, TableEvent>(
      this.pinnedColumnsChangeDetails,
      this.pinnedColumnsChange,
    )
    const onExpandedRowsChange = changeEmitter<readonly string[], TableEvent>(
      this.expandedRowsChangeDetails,
      this.expandedRowsChange,
    )
    const { view, send } = injectMachine(
      tableMachine,
      () => ({
        root: instance(),
        messages: texts(),
        lang: locale().locale,
        sort: controlled(),
        defaultSort: initial(),
        onSortChange,
        allowUnsorted: this.allowUnsorted(),
        pinnedColumns: this.pinnedColumns(),
        defaultPinnedColumns: this.defaultPinnedColumns(),
        onPinnedColumnsChange,
        rowCount: this.rowCount(),
        rowRange: this.rowRange(),
        expandedRows: this.expandedRows(),
        defaultExpandedRows: this.defaultExpandedRows(),
        onExpandedRowsChange,
        multiple: this.multiple(),
      }),
      tableEnv,
    )
    this.send = send
    const mounted = signal(false)
    if (inject(PLATFORM_ID) === "browser") afterNextRender(() => mounted.set(true))
    const captionId = injectRenderedId(this.registry, "caption")
    this.captioned = computed(() => captionId() !== undefined)
    const f = injectFocus()
    this.state = computed(() => ({
      sort: view().values.sort.value,
      scrollStop: view().context.tabStop,
    }))
    this.api = computed(() => {
      const c = view().context
      return tableConnect({
        instance: instance(),
        sort: view().values.sort.value,
        messages: texts(),
        tabStop: c.tabStop,
        holdsControls: c.measured && (c.overflow.x || c.overflow.y) && c.tabbableContent,
        overflow: c.overflow,
        edges: c.edges,
        focused: f.focused(),
        modality: f.modality(),
        stickyFirstColumn: this.stickyFirstColumn(),
        empty: this.emptyCount() > 0,
        captionId: captionId() ?? frame?.title(),
        tableLabel: this.tableLabel(),
        describeSort: mounted() && quirkActive("talkback-aria-sort", env),
        pinned: view().values.pinnedColumns,
        expandedRows: view().values.expandedRows,
      })
    })
    bindProps(
      () => ({
        ...joinHandlers(this.api().root(), {
          onFocus: (e: FocusEvent) => {
            if (e.target !== e.currentTarget) return
            f.focused.set(true)
            send({ type: "ROOT.FOCUS" })
          },
          onBlur: (e: FocusEvent) => {
            if (e.target !== e.currentTarget) return
            f.focused.set(false)
            send({ type: "ROOT.BLUR" })
          },
        }),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      { owns: ["id", "stickyfirstcolumn", "allowunsorted", "multiple", "rowcount", "locale"] },
    )
  }
}

/** The `<table rindTableTable>`: named by its Caption, the Frame's Title or `aria-label`. */
@Directive({ selector: "[rindTableTable]", exportAs: "rindTableTable" })
export class TableTable {
  /** `aria-busy="true"` and `data-loading`. */
  readonly loading = input(false, { transform: booleanAttribute })
  constructor() {
    const ctx = injectTable("Table")
    const el: Element = inject(ElementRef).nativeElement
    const { statics } = bindProps(
      () => {
        // No Caption and no label of its own: the Frame's Title names it.
        const titled =
          !ctx.captioned() &&
          !statics.has("aria-label") &&
          !statics.has("aria-labelledby") &&
          ctx.frame?.title() !== undefined
        return {
          ...ctx.api().table({ loading: this.loading() }),
          ...(titled ? { "aria-labelledby": ctx.frame?.title() } : {}),
        }
      },
      { owns: ["loading"] },
    )
    ctx.tableLabel.set(statics.get("aria-label"))
    // After render: the Caption, or a label, names the table (spec "Name").
    if (inject(PLATFORM_ID) !== "browser" || !isDevMode()) return
    // Once stable: after the re-render a Caption or a Title causes when it registers.
    const app = inject(ApplicationRef)
    const check = () => {
      if (!(el instanceof HTMLTableElement) || !el.isConnected) return
      if (el.caption || el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby")) return
      warnOnce(
        untracked(ctx.instance),
        "a table needs a name: render rindTableCaption, rindTableTitle or aria-label",
      )
    }
    afterEveryRender(() => void app.whenStable().then(check))
  }
}

/** The table's name: `<caption rindTableCaption>`. */
@Directive({ selector: "[rindTableCaption]", exportAs: "rindTableCaption" })
export class TableCaption {
  readonly id = input<string>()
  constructor() {
    const ctx = injectTable("Caption")
    const own = computed(() => this.id() ?? `table-${ctx.instance()}-caption`)
    injectRegisterPart(ctx.registry, "caption", own)
    const frame = ctx.frame
    if (frame) {
      const ready = injectRendered()
      effect(() => {
        const id = own()
        if (ready()) untracked(() => frame.caption.set(id))
      })
      inject(DestroyRef).onDestroy(() => frame.caption.set(undefined))
    }
    bindProps(() => ctx.api().caption(own()), { owns: ["id"] })
  }
}

/** A part with no state of its own: connect's props. */
@Directive()
abstract class SimplePart {
  protected wire(name: string, pick: (api: Api) => PartProps) {
    const ctx = injectTable(name)
    bindProps(() => pick(ctx.api()))
  }
}

@Directive({ selector: "[rindTableHead]", exportAs: "rindTableHead" })
export class TableHead extends SimplePart {
  constructor() {
    super()
    this.wire("Head", (api) => api.head())
  }
}

@Directive({ selector: "[rindTableBody]", exportAs: "rindTableBody" })
export class TableBody extends SimplePart {
  constructor() {
    super()
    this.wire("Body", (api) => api.body())
  }
}

@Directive({ selector: "[rindTableFoot]", exportAs: "rindTableFoot" })
export class TableFoot extends SimplePart {
  constructor() {
    super()
    this.wire("Foot", (api) => api.foot())
  }
}

@Directive({ selector: "[rindTableCell]", exportAs: "rindTableCell" })
export class TableCell extends SimplePart {
  constructor() {
    super()
    this.wire("Cell", (api) => api.cell())
  }
}

/** A row: `<tr rindTableRow>`; with an `id` it can expand (`expandedRows`, RowTrigger, RowDetails). */
@Directive({
  selector: "[rindTableRow]",
  exportAs: "rindTableRow",
  providers: [{ provide: ROW, useExisting: forwardRef(() => TableRow) }],
})
export class TableRow {
  /** The row id: needed to expand it. */
  readonly id = input<string>()
  /** @internal The RowHeader's text (measured after render; the id until then). */
  readonly text: Signal<string | undefined>
  constructor() {
    const ctx = injectTable("Row")
    const el: Element = inject(ElementRef).nativeElement
    const measured = signal<string | undefined>(undefined)
    this.text = computed(() => measured() ?? this.id())
    bindProps(
      () => {
        const id = this.id()
        return {
          ...ctx.api().row(id),
          ...(id === undefined ? {} : { id: itemId("table", ctx.instance(), "row", id) }),
        }
      },
      { owns: ["id"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    afterEveryRender({
      read: () => {
        if (untracked(this.id) === undefined) return
        const header = el.querySelector<HTMLElement>(':scope > [data-part="row-header"]')
        const next = header ? visibleText(header) : undefined
        if (next !== untracked(measured)) measured.set(next)
      },
    })
  }
}

/** Opens the row's details: `<button rindTableRowTrigger>`, inside a Row with an `id`. */
@Directive({ selector: "[rindTableRowTrigger]", exportAs: "rindTableRowTrigger" })
export class TableRowTrigger {
  constructor() {
    const ctx = injectTable("RowTrigger")
    const row = inject(ROW, { optional: true })
    if (!row) throw new Error("rindTableRowTrigger must be inside a rindTableRow with an `id`")
    const f = injectFocus()
    const rowId = () => {
      const id = row.id()
      if (id === undefined) {
        throw new Error("rindTableRowTrigger must be inside a rindTableRow with an `id`")
      }
      return id
    }
    const { statics } = bindProps(() => {
      const id = rowId()
      const named = statics.has("aria-label") || statics.has("aria-labelledby")
      return joinHandlers(
        ctx.api().rowTrigger(id, {
          text: row.text() ?? id,
          named,
          focused: f.focused(),
          modality: f.modality(),
        }),
        f.handlers,
        { onClick: () => ctx.send({ type: "ROW.TOGGLE", row: untracked(rowId) }) },
      )
    })
  }
}

/** The one cell of a RowDetails, spanning the row. Internal. */
@Directive({ selector: "[rindTableSpanCell]" })
export class TableSpanCell {
  readonly rindTableSpanCell = input.required<PartProps>()
  constructor() {
    bindProps(() => this.rindTableSpanCell())
  }
}

/**
 * A row's details: `<tr rindTableRowDetails rowId="apple">`, right after that Row; its content
 * goes in the one cell it renders.
 */
@Component({
  selector: "[rindTableRowDetails]",
  exportAs: "rindTableRowDetails",
  imports: [TableSpanCell],
  encapsulation: ViewEncapsulation.None,
  template: `<td [rindTableSpanCell]="cell()"><ng-content /></td>`,
})
export class TableRowDetails {
  /** The id of the Row these details belong to (render it right after that Row). */
  readonly rowId = input.required<string>()
  /** The cell's span; default: the leaf columns counted after render. */
  readonly colSpan = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Props of the one cell spanning the row. */
  readonly cellProps = input<PartProps>()
  /** @internal */
  protected readonly cell: Signal<PartProps>
  constructor() {
    const ctx = injectTable("RowDetails")
    const span = injectLeafColumns(() => this.colSpan())
    this.cell = computed(() => {
      const n = this.colSpan() ?? span()
      return { ...(n === undefined ? {} : { colspan: String(n) }), ...this.cellProps() }
    })
    bindProps(() => ctx.api().rowDetails(this.rowId()), { owns: ["rowid"] })
  }
}

/** A column's header: `<th rindTableColumnHeader>`. */
@Directive({
  selector: "[rindTableColumnHeader]",
  exportAs: "rindTableColumnHeader",
  providers: [{ provide: COLUMN, useExisting: forwardRef(() => TableColumnHeader) }],
})
export class TableColumnHeader {
  /** Holds a SortTrigger; needs `id`. */
  readonly sortable = input(false, { transform: booleanAttribute })
  /** The column id: unique in the table, what `sort.column` and `pinnedColumns` hold. */
  readonly id = input<string>()
  /** The direction of a first press on this column. Default `ascending`. */
  readonly firstDirection = input<SortDirection>("ascending")
  readonly colSpan = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** @internal The column's text (measured after render; the id until then). */
  readonly text: Signal<string>
  /** @internal */
  readonly filters = signal(0)

  constructor() {
    const ctx = injectTable("ColumnHeader")
    const el: Element = inject(ElementRef).nativeElement
    const measured = signal<string | undefined>(undefined)
    this.text = computed(() => measured() ?? this.id() ?? "")
    effect((onCleanup) => {
      const id = this.id()
      if (this.sortable() && (id === undefined || id === "")) {
        throw new Error("rindTableColumnHeader: a sortable column needs a non-empty `id`")
      }
      if (id === undefined) return
      if (isDevMode() && ctx.columns.has(id)) {
        console.error(`[rind-ui] table: two columns have the id "${id}"`)
      }
      ctx.columns.add(id)
      onCleanup(() => ctx.columns.delete(id))
    })
    bindProps(
      () => {
        const id = this.id()
        const colSpan = this.colSpan()
        return {
          ...ctx.api().columnHeader({
            colSpan,
            column: id,
            sortable: this.sortable(),
            controls: this.filters() > 0,
            text: measured(),
          }),
          ...(colSpan === undefined ? {} : { colspan: String(colSpan) }),
          ...(id === undefined ? {} : { id: itemId("table", ctx.instance(), "column", id) }),
        }
      },
      { owns: ["id", "colspan", "sortable", "firstdirection"] },
    )
    // A Filter inside: the header is named by its text alone (MUI-X#19239); the text is read
    // after render, without the filter's own button.
    if (inject(PLATFORM_ID) !== "browser") return
    afterEveryRender({
      read: () => {
        if (untracked(this.filters) === 0) return
        const copy = el.cloneNode(true) as HTMLElement
        for (const n of Array.from(copy.querySelectorAll('[data-part="filter-trigger"]'))) {
          n.remove()
        }
        const next = visibleText(copy)
        if (next !== untracked(measured)) measured.set(next)
      },
    })
  }

  /** @internal A Filter registers while rendered. */
  addFilter(): () => void {
    this.filters.update((n) => n + 1)
    return () => this.filters.update((n) => n - 1)
  }
}

/** A row's header cell: `<th rindTableRowHeader>`. */
@Directive({ selector: "[rindTableRowHeader]", exportAs: "rindTableRowHeader" })
export class TableRowHeader {
  readonly rowSpan = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  constructor() {
    const ctx = injectTable("RowHeader")
    bindProps(
      () => {
        const rowSpan = this.rowSpan()
        return {
          ...ctx.api().rowHeader({ rowSpan }),
          ...(rowSpan === undefined ? {} : { rowspan: String(rowSpan) }),
        }
      },
      { owns: ["rowspan"] },
    )
  }
}

/** The column a sort part sits in; throws outside a sortable ColumnHeader. */
function injectSortColumn(part: string) {
  const column = inject(COLUMN, { optional: true })
  if (!column || !untracked(column.sortable)) {
    throw new Error(`rindTable${part} must be inside a sortable rindTableColumnHeader`)
  }
  // A sortable column has an id (the ColumnHeader throws otherwise).
  return { column, id: () => column.id() ?? "" }
}

/** Sorts by its column: `<button rindTableSortTrigger>`, inside a sortable ColumnHeader. */
@Component({
  selector: "[rindTableSortTrigger]",
  exportAs: "rindTableSortTrigger",
  imports: [VisuallyHidden],
  encapsulation: ViewEncapsulation.None,
  // Hidden from the name (aria-hidden); still read as the description.
  template: `<ng-content />@if (sortState(); as s) {<span rindVisuallyHidden [id]="s.id" aria-hidden="true">{{ s.text }}</span>}`,
})
export class TableSortTrigger {
  /** @internal */
  protected readonly sortState: Signal<{ readonly id: string; readonly text: string } | null>
  constructor() {
    const ctx = injectTable("SortTrigger")
    const { column, id } = injectSortColumn("SortTrigger")
    const f = injectFocus()
    this.sortState = computed(() => ctx.api().sortState(id()))
    bindProps(() =>
      joinHandlers(
        ctx.api().sortTrigger(id(), { focused: f.focused(), modality: f.modality() }),
        f.handlers,
        {
          // A native button: pointer, Enter, Space and an assistive technology's bare click.
          onClick: (e: MouseEvent) =>
            ctx.send({
              type: "SORT",
              column: untracked(id),
              name: visibleText(e.currentTarget as HTMLElement),
              firstDirection: untracked(column.firstDirection),
              modality: f.env.modality.modality(),
            }),
        },
      ),
    )
  }
}

/**
 * The sort direction: `<span rindTableSortIndicator>`. Its content, else the provider's icon
 * for the direction (`caret-up`, `caret-down`, `caret-up-down`), else nothing (the theme
 * draws the shape). `direction()` gives the content its own per direction.
 */
@Component({
  selector: "[rindTableSortIndicator]",
  exportAs: "rindTableSortIndicator",
  imports: [NgComponentOutlet],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>@if (icon(); as i) {<ng-container *ngComponentOutlet="i" />}</ng-content>`,
})
export class TableSortIndicator {
  /** The column's direction: `ascending`, `descending` or `none`. */
  readonly direction: Signal<SortDirection | "none">
  /** @internal */
  protected readonly icon: Signal<Type<unknown> | undefined>
  constructor() {
    const ctx = injectTable("SortIndicator")
    const { id } = injectSortColumn("SortIndicator")
    this.direction = computed(() => {
      const sort = ctx.state().sort
      return sort && sort.column === id() ? sort.direction : "none"
    })
    const icons = {
      ascending: injectIcon("caret-up"),
      descending: injectIcon("caret-down"),
      none: injectIcon("caret-up-down"),
    }
    this.icon = computed(() => icons[this.direction()]())
    bindProps(() => ctx.api().sortIndicator(id()))
  }
}

// ── Frame, Header, Footer and the full-page view (table-columns-and-toolbar design §4) ──

/** The table's surroundings: `<div rindTableFrame>`, which can go full page as a modal dialog. */
@Directive({
  selector: "[rindTableFrame]",
  exportAs: "rindTableFrame",
  providers: [{ provide: FRAME, useExisting: forwardRef(() => TableFrame) }],
})
export class TableFrame {
  /** Full page: the Frame covers the viewport as a modal dialog (`[(expanded)]`). */
  readonly expanded = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultExpanded = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Overrides the strings ("Full page"); also through the provider. */
  readonly messages = input<MessageOverrides<TableMessages>>()
  readonly id = input<string>()
  readonly expandedChangeDetails = output<ChangeEvent<boolean, TableFrameEvent>>()
  readonly expandedChange = output<boolean>()

  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly api: Signal<FrameApi>
  /** @internal */
  readonly send: (event: TableFrameEvent) => void
  /** @internal */
  readonly caption = signal<string | undefined>(undefined)
  /** @internal The Title's id: names the table and the full-page view when there is no Caption. */
  readonly title = signal<string | undefined>(undefined)
  /** The frame's state, for the template (`#f="rindTableFrame"`, `f.state()`). */
  readonly state: Signal<TableFrameRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const texts = injectMessages("table", tableMessages, () => this.messages())
    const env = injectEnvironment()
    const onExpandedChange = changeEmitter<boolean, TableFrameEvent>(
      this.expandedChangeDetails,
      this.expandedChange,
    )
    const { view, send } = injectMachine(
      tableFrameMachine,
      () => ({
        root: instance(),
        expanded: this.expanded(),
        defaultExpanded: this.defaultExpanded(),
        onExpandedChange,
      }),
      env,
    )
    this.send = send
    const expanded = computed(() => view().values.expanded)
    this.state = computed(() => ({ expanded: expanded() }))
    this.api = computed(() =>
      tableFrameConnect({
        instance: instance(),
        expanded: expanded(),
        messages: texts(),
        captionId: this.caption() ?? this.title(),
        ids: tableFrameIds(instance()),
      }),
    )
    bindProps(() => this.api().frame(), { owns: ["id"] })
  }
}

@Directive({ selector: "[rindTableHeader]", exportAs: "rindTableHeader" })
export class TableHeader {
  constructor() {
    const f = injectFrame("Header")
    bindProps(() => f.api().header())
  }
}

@Directive({ selector: "[rindTableFooter]", exportAs: "rindTableFooter" })
export class TableFooter {
  constructor() {
    const f = injectFrame("Footer")
    bindProps(() => f.api().footer())
  }
}

/** The frame's title: `<div rindTableTitle>`; it names the table when there is no Caption. */
@Directive({ selector: "[rindTableTitle]", exportAs: "rindTableTitle" })
export class TableTitle {
  readonly id = input<string>()
  constructor() {
    const f = injectFrame("Title")
    const own = computed(() => this.id() ?? `table-${f.instance()}-title`)
    // After render: the server's table is not named by it (as React's, set in a layout effect).
    const ready = injectRendered()
    effect(() => {
      const id = own()
      if (ready()) untracked(() => f.title.set(id))
    })
    inject(DestroyRef).onDestroy(() => f.title.set(undefined))
    bindProps(() => f.api().title(own()), { owns: ["id"] })
  }
}

/** Marks a part's default content as rendered (no content of the consumer's). Internal. */
@Directive({ selector: "[rindTableFallback]" })
export class TableFallback {
  constructor() {
    const owner = inject(TableExpandTrigger)
    owner.fallback.set(true)
    inject(DestroyRef).onDestroy(() => owner.fallback.set(false))
  }
}

/**
 * Full page and back: `<button rindTableExpandTrigger>`. Its content names it; empty, it shows
 * the provider's `arrows-out` / `arrows-in` icon and is named "Full page".
 */
@Component({
  selector: "[rindTableExpandTrigger]",
  exportAs: "rindTableExpandTrigger",
  imports: [NgComponentOutlet, TableFallback],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content><ng-container rindTableFallback />@if (icon(); as i) {<ng-container *ngComponentOutlet="i" />}</ng-content>`,
})
export class TableExpandTrigger {
  /** @internal */
  readonly fallback = signal(false)
  /** @internal */
  protected readonly icon: Signal<Type<unknown> | undefined>
  constructor() {
    const f = injectFrame("ExpandTrigger")
    const focus = injectFocus()
    const arrowsIn = injectIcon("arrows-in")
    const arrowsOut = injectIcon("arrows-out")
    this.icon = computed(() => (f.state().expanded ? arrowsIn() : arrowsOut()))
    bindProps(() =>
      joinHandlers(
        f.api().expandTrigger({
          named: !this.fallback(),
          focused: focus.focused(),
          modality: focus.modality(),
        }),
        focus.handlers,
        { onClick: () => f.send({ type: "TOGGLE" }) },
      ),
    )
  }
}

// ── Filters: a Popover scoped to the table, inside a ColumnHeader (design §2) ──

/**
 * A column's filter: `<ng-container rindTableFilter>` in a ColumnHeader with an `id`, a
 * Popover (`[(open)]`, `defaultOpen`) holding a FilterTrigger and, in
 * `<ng-template rindTableFilterPortal>`, a FilterPositioner with the FilterContent.
 */
@Directive({
  selector: "[rindTableFilter]",
  exportAs: "rindTableFilter",
  hostDirectives: [
    {
      directive: PopoverRoot,
      inputs: ["open", "defaultOpen"],
      outputs: ["openChange", "openChangeDetails"],
    },
  ],
  providers: [
    { provide: POPOVER_SCOPE, useValue: "table" },
    { provide: FILTER, useExisting: forwardRef(() => TableFilter) },
  ],
})
export class TableFilter {
  /** The column is filtered: the trigger is marked and described "Filtered". */
  readonly active = input(false, { transform: booleanAttribute })
  /** @internal */
  readonly column: TableColumnHeader
  constructor() {
    const column = inject(COLUMN, { optional: true })
    if (!column) throw new Error("rindTableFilter must be inside a rindTableColumnHeader")
    this.column = column
    effect(() => {
      if (column.id() === undefined) {
        throw new Error("rindTableFilter must be inside a rindTableColumnHeader with an `id`")
      }
    })
    const remove = column.addFilter()
    inject(DestroyRef).onDestroy(remove)
  }
}

/** Opens the filter: `<button rindTableFilterTrigger>`, named "Filter <column>". */
@Component({
  selector: "[rindTableFilterTrigger]",
  exportAs: "rindTableFilterTrigger",
  imports: [VisuallyHidden],
  hostDirectives: [PopoverTrigger],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content />@if (filterState(); as s) {<span rindVisuallyHidden [id]="s.id" aria-hidden="true">{{ s.text }}</span>}`,
})
export class TableFilterTrigger {
  /** @internal */
  protected readonly filterState: Signal<{ readonly id: string; readonly text: string } | null>
  constructor() {
    const ctx = injectTable("FilterTrigger")
    const f = injectFilter("FilterTrigger")
    const id = () => f.column.id() ?? ""
    this.filterState = computed(() => ctx.api().filterState(id(), f.active()))
    const { statics } = bindProps(() =>
      ctx.api().filterTrigger(id(), {
        text: f.column.text(),
        active: f.active(),
        named: statics.has("aria-label") || statics.has("aria-labelledby"),
      }),
    )
  }
}

/** Places the filter: `<div rindTableFilterPositioner>`, in `rindTableFilterPortal`. */
@Directive({
  selector: "[rindTableFilterPositioner]",
  exportAs: "rindTableFilterPositioner",
  hostDirectives: [PopoverPositioner],
})
export class TableFilterPositioner {
  constructor() {
    injectFilter("FilterPositioner")
    bindProps(() => ({ "data-part": "filter-positioner" }))
  }
}

/** The filter's dialog: `<div rindTableFilterContent>`, named "Filter <column>". */
@Directive({
  selector: "[rindTableFilterContent]",
  exportAs: "rindTableFilterContent",
  hostDirectives: [PopoverContent],
})
export class TableFilterContent {
  constructor() {
    const ctx = injectTable("FilterContent")
    const f = injectFilter("FilterContent")
    const { statics } = bindProps(() => {
      const label = ctx.api().filterTrigger(f.column.id() ?? "", {
        text: f.column.text(),
        active: false,
        named: false,
      })["aria-label"]
      return {
        "data-part": "filter-content",
        ...(statics.has("aria-label") ? {} : { "aria-label": label }),
      }
    })
  }
}

/**
 * The filter's state: `<span rindTableFilterIndicator>`. Its content, else the provider's
 * `funnel` (active) or `funnel-simple` icon; `active()` gives the content its own.
 */
@Component({
  selector: "[rindTableFilterIndicator]",
  exportAs: "rindTableFilterIndicator",
  imports: [NgComponentOutlet],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>@if (icon(); as i) {<ng-container *ngComponentOutlet="i" />}</ng-content>`,
})
export class TableFilterIndicator {
  /** The column is filtered. */
  readonly active: Signal<boolean>
  /** @internal */
  protected readonly icon: Signal<Type<unknown> | undefined>
  constructor() {
    const ctx = injectTable("FilterIndicator")
    const f = injectFilter("FilterIndicator")
    this.active = f.active
    const funnel = injectIcon("funnel")
    const simple = injectIcon("funnel-simple")
    this.icon = computed(() => (f.active() ? funnel() : simple()))
    bindProps(() => ctx.api().filterIndicator(f.active()))
  }
}

/** The row shown while there are none: `<tr rindTableEmpty>`; its content goes in its one cell. */
@Component({
  selector: "[rindTableEmpty]",
  exportAs: "rindTableEmpty",
  imports: [TableSpanCell],
  encapsulation: ViewEncapsulation.None,
  template: `<td [rindTableSpanCell]="cell()"><ng-content /></td>`,
})
export class TableEmpty {
  /** The cell's span; default: the leaf columns counted after render (one on the server). */
  readonly colSpan = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** @internal */
  protected readonly cell: Signal<PartProps>
  constructor() {
    const ctx = injectTable("Empty")
    const span = injectLeafColumns(() => this.colSpan())
    this.cell = computed(() => {
      const n = this.colSpan() ?? span()
      return n === undefined ? {} : { colspan: String(n) }
    })
    bindProps(() => ctx.api().empty())
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => ctx.emptyCount.update((n) => n + 1))
    inject(DestroyRef).onDestroy(() => ctx.emptyCount.update((n) => n - 1))
  }
}

/** The Table's parts, for a standalone component's `imports`. */
export const Table = [
  TableRoot,
  TableTable,
  TableCaption,
  TableHead,
  TableBody,
  TableFoot,
  TableRow,
  TableRowTrigger,
  TableRowDetails,
  TableColumnHeader,
  TableRowHeader,
  TableCell,
  TableSortTrigger,
  TableSortIndicator,
  TableFrame,
  TableHeader,
  TableFooter,
  TableTitle,
  TableExpandTrigger,
  TableFilter,
  TableFilterTrigger,
  TableFilterPositioner,
  TableFilterContent,
  TableFilterIndicator,
  TableEmpty,
] as const
