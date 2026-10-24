// Listbox: the Root hosting the listbox parts. Wiring only: the machine owns highlight,
// selection and typeahead; the core parts own every attribute.
import {
  booleanAttribute,
  computed,
  Directive,
  forwardRef,
  inject,
  input,
  output,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  createListCollection,
  type FocusStrategy,
  type ListboxActionDetails,
  type ListboxValue,
  type LoadingStatus,
  layoutCapability,
  listboxConnect,
  listboxIds,
  listboxMachine,
  type ScrollToIndexDetails,
  selectionOf,
} from "@rind-ui/core"
import { injectCollectionItems } from "../collection-items"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment } from "../provider"
import {
  groupsOf,
  LISTBOX_HOST,
  ListboxEmpty,
  type ListboxGroup,
  type ListboxHost,
  ListboxItem,
  ListboxItemDescription,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
  ListboxList,
  ListboxLoadMore,
  ListboxSection,
  ListboxSeparator,
} from "./parts"

/** One item of a data-driven listbox. */
export interface ListboxItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly section?: { readonly key: string; readonly label: string }
}
const fromData = (items: readonly ListboxItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
const EMPTY = fromData([])

export interface ListboxChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

/**
 * A list of options: `<ng-container rindListboxRoot [(value)]="fruit">` (it renders no
 * element) holding a Label and the `<div rindListboxList>` of `rindListboxItem` options. With
 * `items`, `#l="rindListboxRoot"` gives `l.groups()` to render them.
 */
@Directive({
  selector: "[rindListboxRoot]",
  exportAs: "rindListboxRoot",
  providers: [
    { provide: LISTBOX_HOST, useFactory: () => inject(forwardRef(() => ListboxRoot)).host },
  ],
})
export class ListboxRoot {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id = input<string>()
  /** `single` (default), `multiple` or `none` (actions only). */
  readonly selectionMode = input<"single" | "multiple" | "none">("single")
  /** `toggle` (default) or `replace` (a press selects only that item; actions are allowed). */
  readonly selectionBehavior = input<"toggle" | "replace">("toggle")
  /** Controlled selection (`[(value)]`): a key or null (single), keys or "all" (multiple). */
  readonly value = input<string | readonly string[] | null>()
  readonly defaultValue = input<string | readonly string[] | null>()
  /** No user action leaves the selection empty. */
  readonly disallowEmptySelection = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false) },
  )
  readonly orientation = input<"vertical" | "horizontal">("vertical")
  readonly disabled = input(false, { transform: booleanAttribute })
  /** A disabled list keeps its Tab stop and disabled items stay reachable (not selectable). */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** `all`: disabled items are skipped and not actionable; `selection`: reachable, only not selectable. Default: `"all"`. */
  readonly disabledBehavior = input<"all" | "selection">()
  /** Arrow keys wrap from the last item to the first and back. Default: `false`. */
  readonly loop = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** How long typed characters build one typeahead search (ms). Default: 1000. */
  readonly typeaheadTimeout = input<number>()
  /** Data items. Without them (and without `collection`), item parts register themselves. */
  readonly items = input<readonly ListboxItemData[]>()
  /** A collection built by the consumer (virtualized lists). */
  readonly collection = input<Collection<unknown>>()
  readonly loading = input<LoadingStatus>()
  readonly onLoadMore = input<() => void>()
  /** Items are not all rendered: the highlighted item is scrolled through `scrollToIndex`, never `scrollIntoView`. */
  readonly virtualized = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** Scrolls the highlighted item into view on navigation, typeahead and open (replaces `scrollIntoView`). */
  readonly scrollToIndex = input<(details: ScrollToIndexDetails) => void>()
  /** `roving`: DOM focus moves to the item; `active-descendant`: focus stays on the list. Default: `"roving"`. */
  readonly strategy = input<FocusStrategy>("roving")
  /** An activation (Enter, a press) in `none` or `replace` mode; its presence enables actions. */
  readonly onAction = input<(key: string, details: ListboxActionDetails) => void>()
  readonly valueChangeDetails = output<{
    value: string | readonly string[] | null
    details: ListboxChangeDetails
  }>()
  /** The selection, for `[(value)]`. */
  readonly valueChange = output<string | readonly string[] | null>()

  /** @internal */
  readonly host: ListboxHost
  /** The data items' sections and items, in render order (data mode). */
  readonly groups: Signal<readonly ListboxGroup[]>

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = injectRootId(() => this.id())
    const { collection: registered, registry } = injectCollectionItems()
    const data = computed(() => {
      const items = this.items()
      return items ? fromData(items) : null
    })
    const collection = computed(() => this.collection() ?? data() ?? registered() ?? EMPTY)
    this.groups = computed(() => groupsOf(collection()))
    const ids = computed(() => listboxIds("listbox", instance()))
    const { view, send, service } = injectMachine(
      listboxMachine,
      () => ({
        collection: collection(),
        ids: ids(),
        strategy: this.strategy(),
        orientation: this.orientation(),
        selectionMode: this.selectionMode(),
        selectionBehavior: this.selectionBehavior(),
        disabled: this.disabled(),
        disallowEmptySelection: this.disallowEmptySelection(),
        disabledBehavior: this.disabledBehavior(),
        focusableWhenDisabled: this.focusableWhenDisabled(),
        loop: this.loop(),
        typeaheadTimeout: this.typeaheadTimeout(),
        loading: this.loading(),
        onLoadMore: this.onLoadMore(),
        virtualized: this.virtualized(),
        scrollToIndex: this.scrollToIndex(),
        ...(this.value() === undefined ? {} : { value: this.value() as ListboxValue }),
        defaultValue:
          (this.defaultValue() as ListboxValue | undefined) ??
          (this.selectionMode() === "multiple" ? [] : null),
        onValueChange: (v: ListboxValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          const value = v as string | readonly string[] | null
          this.valueChangeDetails.emit({ value, details: { reason: e.type, key: e.key } })
          this.valueChange.emit(value)
        },
        onAction: this.onAction()
          ? (key: string, d: ListboxActionDetails) => untracked(this.onAction)?.(key, d)
          : undefined,
      }),
      env,
    )
    const mounted = signal<{
      label: boolean
      empty: boolean
      descriptions: ReadonlySet<CollectionKey>
    }>({ label: false, empty: false, descriptions: new Set() })
    const focused = () => view().matches("focused")
    const modality = injectModality(env.modality, focused)
    let loadedFor: Collection<unknown> | null = null
    const parts = computed(() =>
      listboxConnect(
        {
          instance: instance(),
          collection: collection(),
          context: view().context,
          selection: selectionOf(view().values.value),
          selectionMode: this.selectionMode(),
          selectionBehavior: this.selectionBehavior(),
          orientation: this.orientation(),
          strategy: this.strategy(),
          disabled: this.disabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          disabledBehavior: this.disabledBehavior(),
          loading: this.loading(),
          pending: !this.collection() && !data() && registered() === null,
          typingAhead: () => {
            const t = service().getSnapshot().context.typeahead
            return (
              t.buffer !== "" &&
              env.clock.now() - t.at <= (untracked(this.typeaheadTimeout) ?? 1000)
            )
          },
          actions: this.onAction() !== undefined,
          focused: focused(),
          modality: modality(),
          mounted: {
            label: mounted().label,
            empty: mounted().empty,
            description: (key: CollectionKey) => mounted().descriptions.has(key),
          },
          send,
        },
        env,
      ),
    )
    this.host = {
      name: "Listbox",
      parts,
      collection,
      registry: () => (this.collection() || this.items() ? null : registry),
      instance,
      mount: (part, on) => {
        const m = untracked(mounted)
        if (m[part] !== on) mounted.set({ ...m, [part]: on })
      },
      mountDescription: (key, on) => {
        const m = untracked(mounted)
        if (m.descriptions.has(key) === on) return
        const next = new Set(m.descriptions)
        if (on) next.add(key)
        else next.delete(key)
        mounted.set({ ...m, descriptions: next })
      },
      requestLoadMore: () => {
        if ((untracked(this.loading) ?? "idle") !== "idle" || loadedFor === untracked(collection))
          return
        loadedFor = untracked(collection)
        untracked(this.onLoadMore)?.()
      },
    }
    // The Root renders no element: the List is the listbox.
  }
}

/** The Listbox's parts, for a standalone component's `imports`. */
export const Listbox = [
  ListboxRoot,
  ListboxLabel,
  ListboxList,
  ListboxItem,
  ListboxItemText,
  ListboxItemDescription,
  ListboxItemIndicator,
  ListboxSection,
  ListboxSeparator,
  ListboxEmpty,
  ListboxLoadMore,
] as const
