// Grid List: the Root hosting the parts (design §3). Wiring only: the machine owns the
// highlight, the child position, selection and actions; connect owns every attribute and the
// key-ownership rule. Rows come from `items` data or from static Item parts.
import {
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
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type GridListActionDetails,
  type GridListItemOptions,
  type GridListLayout,
  type GridListMessages,
  type GridListParts,
  type GridListValue,
  gridListConnect,
  gridListIds,
  gridListMachine,
  gridSelectionOf,
  layoutCapability,
  type PartProps,
  toKey,
  warnForeignFocusables,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectCollectionItems, injectRegisterItem } from "../collection-items"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment } from "../provider"
import { RindProps } from "../rind-props"

declare const process: { env: { NODE_ENV?: string } }

/** One row of a data-driven list. */
export interface GridListItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link row: Enter and a press follow it. */
  readonly href?: string
}
const fromData = (items: readonly GridListItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY = fromData([])

export interface GridListChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

/** A row of the data, for a template's `@for` (`#g="rindGridListRoot"`, `g.rows()`). */
export interface GridListRowData {
  readonly key: string
  readonly label: string
  readonly disabled: boolean
}

const GRID_LIST = new InjectionToken<GridListRoot>("rind-ui.grid-list")
const ITEM = new InjectionToken<GridListItem>("rind-ui.grid-list-item")
const LIST = new InjectionToken<boolean>("rind-ui.grid-list-list")

function injectHost(part: string): GridListRoot {
  const root = inject(GRID_LIST, { optional: true })
  if (!root) throw new Error(`rindGridList${part} must be inside rindGridListRoot`)
  return root
}
function injectItemKey(part: string): () => CollectionKey {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindGridList${part} must be inside rindGridListItem`)
  return item.key
}

const toggle = <T>(set: ReadonlySet<T>, key: T, on: boolean): ReadonlySet<T> => {
  if (set.has(key) === on) return set
  const next = new Set(set)
  if (on) next.add(key)
  else next.delete(key)
  return next
}

/**
 * Rows that are selected, acted on or followed, and may hold buttons, links and fields:
 * `<ng-container rindGridListRoot>` (it renders no element) with a Label and the
 * `<div rindGridListList>` grid of `rindGridListItem` rows.
 */
@Directive({
  selector: "[rindGridListRoot]",
  exportAs: "rindGridListRoot",
  providers: [{ provide: GRID_LIST, useExisting: forwardRef(() => GridListRoot) }],
})
export class GridListRoot {
  /** The base the parts' ids derive from. Default: generated. */
  readonly id = input<string>()
  /** `none` (default), `single` or `multiple`. */
  readonly selectionMode = input<"none" | "single" | "multiple">("none")
  readonly selectionBehavior = input<"toggle" | "replace">("toggle")
  /** Controlled selection (`[(value)]`). */
  readonly value = input<string | readonly string[] | null>()
  readonly defaultValue = input<string | readonly string[] | null>()
  /** No user action leaves the selection empty. */
  readonly disallowEmptySelection = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false) },
  )
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled rows stay navigable, and a disabled list keeps its Tab stop. */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** "selection": a disabled row is not selectable but still acts. Default: "all". */
  readonly disabledBehavior = input<"all" | "selection">()
  /** Arrow keys wrap around. Default false. */
  readonly loop = input(false, { transform: booleanAttribute })
  /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
  readonly typeaheadTimeout = input<number>()
  readonly disallowTypeAhead = input(false, { transform: booleanAttribute })
  readonly childNavigation = input<"arrow" | "tab">("arrow")
  readonly layout = input<GridListLayout>("stack")
  readonly items = input<readonly GridListItemData[]>()
  /** A collection built by the consumer (wins over `items` and Item parts). */
  readonly collection = input<Collection<unknown>>()
  readonly onAction = input<(key: string, details: GridListActionDetails) => void>()
  /** Presses select on pointer up (for lists inside popups). Default false. */
  readonly selectOnPressUp = input(false, { transform: booleanAttribute })
  /** Focus the selected row (else the first) once there are rows. */
  readonly autoFocus = input(false, { transform: booleanAttribute })
  readonly onLoadMore = input<() => void>()
  /** Selection announcements and the checkboxes' names. */
  readonly messages = input<Partial<GridListMessages>>()
  readonly valueChangeDetails = output<{
    value: string | readonly string[] | null
    details: GridListChangeDetails
  }>()
  /** The selection, for `[(value)]`. */
  readonly valueChange = output<string | readonly string[] | null>()

  /** @internal */
  readonly parts: Signal<GridListParts>
  /** @internal */
  readonly registry: () => ReturnType<typeof injectCollectionItems>["registry"] | null
  /** @internal */
  readonly instance: () => string
  /** The data rows, for a template's `@for`. */
  readonly rows: Signal<readonly GridListRowData[]>
  /** @internal */
  readonly requestLoadMore: () => void
  private readonly label = signal(false)
  private readonly descriptions = signal<ReadonlySet<CollectionKey>>(new Set())
  private readonly checkboxes = signal<ReadonlySet<CollectionKey>>(new Set())
  private readonly staticLinks = signal<ReadonlyMap<CollectionKey, string>>(new Map())
  private readonly hovered = signal<CollectionKey | null>(null)
  private readonly pressed = signal<CollectionKey | null>(null)
  // Per-row actions (Item `onAction`): any of them makes the list actionable.
  private readonly rowActions = new Map<CollectionKey, (details: GridListActionDetails) => void>()
  // Bumped whenever a row gains or loses its action (keys can swap at the same count).
  private readonly rowActionVersion = signal(0)

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const { collection: registered, registry } = injectCollectionItems()
    const data = computed(() => {
      const items = this.items()
      return items ? fromData(items) : null
    })
    const collection = computed(() => this.collection() ?? data() ?? registered() ?? EMPTY)
    this.registry = () => (this.collection() || this.items() ? null : registry)
    this.rows = computed(() => {
      const out: GridListRowData[] = []
      for (const node of collection())
        if (node.type === "item")
          out.push({ key: node.key, label: node.textValue, disabled: node.disabled === true })
      return out
    })
    const ids = computed(() => gridListIds(instance()))
    const links = computed(() => {
      const out = new Map(this.staticLinks())
      for (const i of this.items() ?? []) if (i.href !== undefined) out.set(toKey(i.key), i.href)
      return out
    })
    const rowActions = this.rowActions
    const actionable = () => {
      this.rowActionVersion()
      return this.onAction() !== undefined || rowActions.size > 0
    }
    // Only the Item actions: the rows that have one (the Root's acts on every row).
    const actionRows = computed(() => {
      this.rowActionVersion()
      return this.onAction() ? undefined : new Set(rowActions.keys())
    })
    const { view, send, service } = injectMachine(
      gridListMachine,
      () => ({
        collection: collection(),
        ids: ids(),
        strategy: "roving" as const,
        selectionMode: this.selectionMode(),
        selectionBehavior: this.selectionBehavior(),
        disallowEmptySelection: this.disallowEmptySelection(),
        disabledBehavior: this.disabledBehavior(),
        focusableWhenDisabled: this.focusableWhenDisabled(),
        disabled: this.disabled(),
        loop: this.loop(),
        typeaheadTimeout: this.typeaheadTimeout(),
        checkboxes: this.checkboxes(),
        messages: this.messages(),
        ...(this.value() === undefined ? {} : { value: this.value() as GridListValue }),
        defaultValue:
          (this.defaultValue() as GridListValue | undefined) ??
          (this.selectionMode() === "multiple" ? [] : null),
        onValueChange: (v: GridListValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          const value = v as string | readonly string[] | null
          this.valueChangeDetails.emit({ value, details: { reason: e.type, key: e.key } })
          this.valueChange.emit(value)
        },
        actionRows: actionRows(),
        onAction: actionable()
          ? (key: string, d: GridListActionDetails) => {
              rowActions.get(toKey(key))?.(d)
              untracked(this.onAction)?.(key, d)
            }
          : undefined,
      }),
      env,
    )
    const focused = () => view().matches("focused")
    const modality = injectModality(env.modality, focused)
    this.parts = computed(() =>
      gridListConnect(
        {
          instance: instance(),
          collection: collection(),
          context: view().context,
          selection: gridSelectionOf(view().values.value as GridListValue),
          selectionMode: this.selectionMode(),
          selectionBehavior: this.selectionBehavior(),
          childNavigation: this.childNavigation(),
          layout: this.layout(),
          actions: (key: CollectionKey) => {
            const rows = actionRows()
            return actionable() && (rows === undefined || rows.has(key))
          },
          selectOnPressUp: this.selectOnPressUp(),
          links: links(),
          disabled: this.disabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          disabledBehavior: this.disabledBehavior(),
          disallowTypeAhead: this.disallowTypeAhead(),
          pending: !this.collection() && !data() && registered() === null,
          focused: focused(),
          modality: modality(),
          hoveredKey: this.hovered(),
          pressedKey: this.pressed(),
          typingAhead: () => {
            const t = service().getSnapshot().context.typeahead
            return (
              t.buffer !== "" &&
              env.clock.now() - t.at <= (untracked(this.typeaheadTimeout) ?? 1000)
            )
          },
          mounted: {
            label: this.label(),
            description: (key: CollectionKey) => this.descriptions().has(key),
          },
          messages: this.messages(),
          send,
        },
        env,
      ),
    )
    let loadedFor: Collection<unknown> | null = null
    this.requestLoadMore = () => {
      if (loadedFor === untracked(collection)) return
      loadedFor = untracked(collection)
      untracked(this.onLoadMore)?.()
    }
    if (inject(PLATFORM_ID) !== "browser") return
    // autoFocus: the selected row, else the first (the machine's tab stop), once rows exist.
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    let autoFocused = false
    effect(() => {
      const c = collection()
      if (!ready() || !this.autoFocus() || autoFocused || c.size === 0) return
      autoFocused = true
      untracked(() => send({ type: "FOCUS", modality: env.modality.modality() }))
    })
  }

  /** @internal */
  mountLabel(on: boolean): void {
    this.label.set(on)
  }
  /** @internal */
  mountDescription(key: CollectionKey, on: boolean): void {
    this.descriptions.set(toggle(untracked(this.descriptions), key, on))
  }
  /** @internal */
  mountCheckbox(key: CollectionKey, on: boolean): void {
    this.checkboxes.set(toggle(untracked(this.checkboxes), key, on))
  }
  /** @internal */
  mountLink(key: CollectionKey, href: string | null): void {
    const m = untracked(this.staticLinks)
    if ((m.get(key) ?? null) === href) return
    const next = new Map(m)
    if (href === null) next.delete(key)
    else next.set(key, href)
    this.staticLinks.set(next)
  }
  /** @internal */
  mountRowAction(key: CollectionKey, fn: ((details: GridListActionDetails) => void) | null): void {
    const had = this.rowActions.has(key)
    if (fn) this.rowActions.set(key, fn)
    else this.rowActions.delete(key)
    if (had !== (fn !== null)) this.rowActionVersion.update((v) => v + 1)
  }
  /** @internal */
  hover(key: CollectionKey | null): void {
    this.hovered.set(key)
  }
  /** @internal */
  press(key: CollectionKey | null): void {
    this.pressed.set(key)
  }
}

/** A static `aria-label` / `aria-labelledby` the part forwards to connect. */
function naming(statics: ReadonlyMap<string, string>) {
  const label = statics.get("aria-label")
  const labelledBy = statics.get("aria-labelledby")
  return {
    ...(label === undefined ? {} : { "aria-label": label }),
    ...(labelledBy === undefined ? {} : { "aria-labelledby": labelledBy }),
  }
}

@Directive({ selector: "[rindGridListLabel]", exportAs: "rindGridListLabel" })
export class GridListLabel {
  constructor() {
    const host = injectHost("Label")
    bindProps(() => host.parts().label())
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => host.mountLabel(true))
    inject(DestroyRef).onDestroy(() => host.mountLabel(false))
  }
}

/** The `grid`: `<div rindGridListList>`, named by the Label or `aria-label`. */
@Directive({
  selector: "[rindGridListList]",
  exportAs: "rindGridListList",
  providers: [{ provide: LIST, useValue: true }],
})
export class GridListList {
  constructor() {
    const host = injectHost("List")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    let own = {}
    const { statics } = bindProps(() => host.parts().list(own))
    own = naming(statics)
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // The modality is tracked from the first render: the first press on a row is a pointer one.
    afterNextRender(() => {
      destroy.onDestroy(env.modality.subscribe(() => {}))
      if (process.env.NODE_ENV === "production") return
      queueMicrotask(() => {
        if (!el.isConnected) return
        if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
          console.warn(
            "[rind-ui] GridList: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.",
          )
        }
      })
    })
  }
}

/** A row: `<div rindGridListItem value="a">`, its content in the cell it renders. */
@Component({
  selector: "[rindGridListItem]",
  exportAs: "rindGridListItem",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: ITEM, useExisting: forwardRef(() => GridListItem) }],
  template: `<div [rindProps]="cellProps()"><ng-content /></div>`,
})
export class GridListItem {
  /** The row key. */
  readonly value = input.required<string>()
  /** The row's text for typeahead and announcements. Default: its ItemText's text. */
  readonly textValue = input<string>()
  /** Disables this row: it cannot be selected and, unless `disabledBehavior` is `"selection"`, it does not act. */
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** A link row: Enter and a press follow it (role stays `row`). */
  readonly href = input<string>()
  /** Marks the row current (`aria-current`, `data-current`), e.g. a link row for the current page. */
  readonly current = input<GridListItemOptions["current"]>()
  /** This row's action (with the Root's `onAction`, both run). */
  readonly onAction = input<(details: GridListActionDetails) => void>()
  /** @internal */
  readonly key = computed(() => toKey(this.value()))
  /** @internal */
  protected readonly cellProps: Signal<PartProps>

  constructor() {
    const host = injectHost("Item")
    const row: Element = inject(ElementRef).nativeElement
    this.cellProps = computed(() => host.parts().itemCell())
    // The row's text is its ItemText, not its controls' labels (typeahead, announcements).
    const ownText = signal<string | undefined>(undefined)
    injectRegisterItem(
      host.registry(),
      () => ({
        key: this.value(),
        textValue: this.textValue() ?? ownText(),
        disabled: this.disabled(),
      }),
      row,
    )
    let own = {}
    const { statics } = bindProps(
      () => {
        const k = this.key()
        return joinHandlers(host.parts().item(k, { ...own, current: this.current() }), {
          onPointerEnter: () => host.hover(k),
          onPointerLeave: () => host.hover(null),
          onPointerDown: () => host.press(k),
          onPointerUp: () => host.press(null),
          onPointerCancel: () => host.press(null),
        })
      },
      { owns: ["current", "disabled", "href", "onaction", "textvalue", "value"] },
    )
    own = naming(statics)
    if (inject(PLATFORM_ID) !== "browser") return
    afterEveryRender(() => {
      const text = row
        .querySelector('[data-scope="grid-list"][data-part="item-text"]')
        ?.textContent?.trim()
      if (text !== untracked(ownText)) ownText.set(text)
      // Development: a focusable the grid cannot reach (not an ItemControl) is named.
      if (row instanceof HTMLElement) warnForeignFocusables(row, "GridList")
    })
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready() || this.onAction() === undefined) return
      const k = this.key()
      untracked(() => host.mountRowAction(k, (d) => untracked(this.onAction)?.(d)))
      onCleanup(() => untracked(() => host.mountRowAction(k, null)))
    })
    effect((onCleanup) => {
      const href = this.href()
      if (!ready() || href === undefined) return
      const k = this.key()
      untracked(() => host.mountLink(k, href))
      onCleanup(() => untracked(() => host.mountLink(k, null)))
    })
  }
}

@Directive({ selector: "[rindGridListItemText]", exportAs: "rindGridListItemText" })
export class GridListItemText {
  constructor() {
    const host = injectHost("ItemText")
    const key = injectItemKey("ItemText")
    bindProps(() => host.parts().itemText(key()))
  }
}

@Directive({ selector: "[rindGridListItemDescription]", exportAs: "rindGridListItemDescription" })
export class GridListItemDescription {
  constructor() {
    const host = injectHost("ItemDescription")
    const key = injectItemKey("ItemDescription")
    bindProps(() => host.parts().itemDescription(key()))
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const k = key()
      untracked(() => host.mountDescription(k, true))
      onCleanup(() => untracked(() => host.mountDescription(k, false)))
    })
  }
}

/** A control's focus and modality (its ring). Call it in a constructor. */
function injectControlFocus() {
  const env = injectEnvironment()
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  return {
    state: () => ({ focused: focused(), modality: modality() }),
    handlers: {
      onFocusIn: () => focused.set(true),
      onFocusOut: () => focused.set(false),
    },
  }
}

/**
 * The row's selection checkbox (`<input rindGridListItemCheckbox>`); with `all` (outside the
 * rows, multiple mode) the select-all checkbox: checked, mixed or unchecked from the selection.
 */
@Directive({ selector: "[rindGridListItemCheckbox]", exportAs: "rindGridListItemCheckbox" })
export class GridListItemCheckbox {
  /** The select-all checkbox (outside the rows, multiple mode) instead of a row's. */
  readonly all = input(false, { transform: booleanAttribute })
  constructor() {
    const host = injectHost("ItemCheckbox")
    const item = inject(ITEM, { optional: true })
    const el: Element = inject(ElementRef).nativeElement
    const focus = injectControlFocus()
    bindProps(
      () =>
        !this.all() && item
          ? { ...host.parts().itemCheckbox(item.key(), focus.state()), ...focus.handlers }
          : host.parts().selectAllCheckbox(),
      { owns: ["all"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready() || this.all() || !item) return
      const k = item.key()
      untracked(() => host.mountCheckbox(k, true))
      onCleanup(() => untracked(() => host.mountCheckbox(k, false)))
    })
    // `indeterminate` is a DOM property, not an attribute.
    afterEveryRender(() => {
      if (!untracked(this.all) || !(el instanceof HTMLInputElement)) return
      el.indeterminate = untracked(host.parts).selectAllCheckbox()["aria-checked"] === "mixed"
    })
  }
}

/** A control of the row: your `<button rindGridListItemControl>`, link or field. */
@Directive({ selector: "[rindGridListItemControl]", exportAs: "rindGridListItemControl" })
export class GridListItemControl {
  constructor() {
    const host = injectHost("ItemControl")
    const key = injectItemKey("ItemControl")
    const focus = injectControlFocus()
    const el: Element = inject(ElementRef).nativeElement
    // `type="button"` for a button without its own: never a submit.
    let ownType = false
    const { statics } = bindProps(() => ({
      ...(el.tagName === "BUTTON" && !ownType ? { type: "button" } : {}),
      ...host.parts().itemControl(key(), focus.state()),
      ...focus.handlers,
    }))
    ownType = statics.has("type")
  }
}

/** Shown while there is no row (inside the List); hidden otherwise (React renders nothing). */
@Directive({ selector: "[rindGridListEmpty]", exportAs: "rindGridListEmpty" })
export class GridListEmpty {
  constructor() {
    const host = injectHost("Empty")
    const inList = inject(LIST, { optional: true }) === true
    bindProps(() =>
      host.parts().isEmpty ? host.parts().empty() : absentProps("grid-list", host.instance()),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => {
      if (process.env.NODE_ENV !== "production" && !inList)
        console.warn(
          "[rind-ui] GridList: Empty is outside List; render it inside rindGridListList.",
        )
    })
  }
}

/** A `row` sentinel: `onLoadMore` once per collection when it scrolls into view. */
@Component({
  selector: "[rindGridListLoadMore]",
  exportAs: "rindGridListLoadMore",
  encapsulation: ViewEncapsulation.None,
  // The row's one cell (a row holds cells); the row itself is the focus target.
  template: `<div role="gridcell"><ng-content /></div>`,
})
export class GridListLoadMore {
  constructor() {
    const host = injectHost("LoadMore")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() => host.parts().loadMore())
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      if (typeof IntersectionObserver === "undefined") return
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) host.requestLoadMore()
      })
      observer.observe(el)
      destroy.onDestroy(() => observer.disconnect())
    })
  }
}

/** The Grid List's parts, for a standalone component's `imports`. */
export const GridList = [
  GridListRoot,
  GridListLabel,
  GridListList,
  GridListItem,
  GridListItemText,
  GridListItemDescription,
  GridListItemCheckbox,
  GridListItemControl,
  GridListEmpty,
  GridListLoadMore,
] as const
