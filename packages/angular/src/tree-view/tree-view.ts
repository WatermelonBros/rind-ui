// Tree View (design §2): wiring only. The machine owns highlight, expansion, selection,
// checking and lazy loads; the core connect owns every attribute and key.
import { NgTemplateOutlet } from "@angular/common"
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  Injector,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  checkTreeView,
  createTreeCollection,
  expansionReason,
  type Href,
  isMovable,
  keySetOf,
  type LinkCurrent,
  layoutCapability,
  linkProps,
  pointerTarget,
  type RouterOptions,
  type ScrollToIndexDetails,
  type TreeCollection,
  type TreeDropZone,
  type TreeViewActionDetails,
  type TreeViewMessages,
  type TreeViewMoveDetails,
  type TreeViewParts,
  type TreeViewValue,
  toKey,
  treeDrag,
  treeSelectionOf,
  treeViewConnect,
  treeViewIds,
  treeViewMachine,
  treeViewMessages,
  visibleOf,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment } from "../provider"

/** One node of a data-driven tree. */
export interface TreeViewItemData {
  readonly key: string
  readonly label: string
  /** Loaded children (empty or absent for a leaf or an unloaded branch). */
  readonly children?: readonly TreeViewItemData[]
  /** A branch even with no loaded children (lazy, or loaded and empty). */
  readonly isBranch?: boolean
  readonly disabled?: boolean
}
const fromData = (items: readonly TreeViewItemData[]) =>
  createTreeCollection<TreeViewItemData>({
    roots: items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    getChildren: (i) => i.children,
    hasUnloadedChildren: (i) => i.isBranch === true,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY_TREE = fromData([])

export interface TreeViewChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}
export interface TreeViewExpandedDetails {
  readonly reason: "key" | "press" | "api" | "siblings" | "all"
}

/** What a row template receives for its node (design §2). */
export interface TreeViewNodeState {
  readonly key: string
  /** The row's position in the visible list (what a virtualizer positions by). */
  readonly index: number
  /** The node's data (a `TreeViewItemData` with `items`). */
  readonly value: unknown
  readonly label: string
  /** 1 for roots. */
  readonly level: number
  readonly posInSet: number
  readonly setSize: number
  readonly isLast: boolean
  readonly parentKey: string | null
  readonly isBranch: boolean
  readonly expanded: boolean
  readonly selected: boolean
  readonly checked: "true" | "false" | "mixed" | undefined
  readonly loading: boolean
  readonly disabled: boolean
}

type Value = string | readonly string[] | null

const TREE_VIEW = new InjectionToken<TreeViewRoot>("rind-ui.tree-view")
const ITEM = new InjectionToken<TreeViewItem>("rind-ui.tree-view-item")

function injectHost(part: string): TreeViewRoot {
  const root = inject(TREE_VIEW, { optional: true })
  if (!root) throw new Error(`rindTreeView${part} must be inside rindTreeViewRoot`)
  return root
}
function injectItemKey(part: string): () => CollectionKey {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindTreeView${part} must be inside rindTreeViewItem`)
  return item.key
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A hierarchy the user expands, navigates and selects or checks:
 * `<ng-container rindTreeViewRoot [items]="files">` (no element of its own) with a Label and a
 * `<div rindTreeViewTree>` whose `<ng-template rindTreeViewRow let-node>` renders each visible
 * node, usually as a `rindTreeViewItem`.
 */
@Directive({
  selector: "[rindTreeViewRoot]",
  exportAs: "rindTreeViewRoot",
  providers: [{ provide: TREE_VIEW, useExisting: forwardRef(() => TreeViewRoot) }],
})
export class TreeViewRoot {
  /** Base of the parts' generated ids (default: generated). */
  readonly id = input<string>()
  /** The tree's data; or `collection`, a tree collection you built. */
  readonly items = input<readonly TreeViewItemData[]>()
  /** A tree collection you built, used instead of `items`. */
  readonly collection = input<TreeCollection<unknown>>()
  /** `single` (default), `multiple` or `none`. */
  readonly selectionMode = input<"single" | "multiple" | "none">("single")
  readonly selectionBehavior = input<"toggle" | "replace">()
  /** Multiple mode: the last selected item cannot be deselected. */
  readonly disallowEmptySelection = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  /** Controlled selection (`[(value)]`). */
  readonly value = input<Value>()
  readonly defaultValue = input<Value>()
  /** Controlled expansion (`[(expandedValue)]`). */
  readonly expandedValue = input<readonly string[]>()
  readonly defaultExpandedValue = input<readonly string[]>()
  readonly checkable = input(false, { transform: booleanAttribute })
  /** Controlled checks (`[(checkedValue)]`). */
  readonly checkedValue = input<readonly string[]>()
  readonly defaultCheckedValue = input<readonly string[]>()
  readonly checkPropagation = input<"both" | "none">()
  readonly expandOnClick = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly onAction = input<(key: string, details: TreeViewActionDetails) => void>()
  readonly onLoadChildren =
    input<
      (key: string, options: { readonly signal: AbortSignal }) => Promise<unknown> | undefined
    >()
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled items (and a disabled tree) stay focusable and reachable by arrows; nothing toggles. */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Arrow moves wrap at both ends. Default: false. */
  readonly loop = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Typeahead reset delay in ms. Default: 1000. */
  readonly typeaheadTimeout = input<number>()
  /** Overrides for the loading announcements and the Empty and Loading default texts. */
  readonly messages = input<Partial<TreeViewMessages>>()
  /** Rows are windowed by the consumer (the Tree's `indexes`): keyboard moves call `scrollToIndex`. */
  readonly virtualized = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Scrolls the highlighted row into view; `index` is its position in the visible list. */
  readonly scrollToIndex = input<(details: ScrollToIndexDetails) => void>()
  /** Nodes can be moved (Alt+arrows, pointer drags): all, or those the predicate allows. */
  readonly movable = input<boolean | ((key: string) => boolean)>()
  /** A node moved: apply it to `items` with `moveNode(items, key, details)`. */
  readonly onMove = input<(key: string, details: TreeViewMoveDetails) => void>()
  readonly valueChangeDetails = output<{ value: Value; details: TreeViewChangeDetails }>()
  /** The selection, for `[(value)]`. */
  readonly valueChange = output<Value>()
  readonly expandedChangeDetails = output<{
    value: readonly string[]
    details: TreeViewExpandedDetails
  }>()
  /** The expanded keys, for `[(expandedValue)]`. */
  readonly expandedValueChange = output<readonly string[]>()
  readonly checkedChangeDetails = output<{
    value: readonly string[]
    details: TreeViewChangeDetails
  }>()
  /** The checked keys, for `[(checkedValue)]`. */
  readonly checkedValueChange = output<readonly string[]>()

  /** @internal */
  readonly parts: Signal<TreeViewParts>
  /** @internal */
  readonly visible: Signal<Collection<unknown>>
  /** @internal */
  readonly focused: () => boolean
  /** @internal */
  readonly texts: Signal<TreeViewMessages>
  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly env = injectEnvironment(announcerCapability, layoutCapability)
  /** @internal */
  readonly dropAt = signal<{ top: number; level: number } | null>(null)
  /** @internal */
  readonly node: (key: CollectionKey) => TreeViewNodeState | undefined
  /** @internal */
  readonly canMove: (key: CollectionKey) => boolean
  /** @internal */
  readonly startDrag: (key: CollectionKey, event: PointerEvent) => void
  /** For a virtualizer: the visible row count and the indexes to keep rendered (the highlighted). */
  readonly visibleRows: Signal<{
    readonly count: number
    readonly persistedIndexes: readonly number[]
  }>
  private readonly label = signal(false)
  private readonly empty = signal(false)
  private readonly itemTexts = signal<ReadonlySet<CollectionKey>>(new Set())
  private readonly hovered = signal<CollectionKey | null>(null)
  private readonly pressed = signal<CollectionKey | null>(null)

  constructor() {
    const env = this.env
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const data = computed(() => {
      const items = this.items()
      return items ? fromData(items) : null
    })
    const tree = computed(() => this.collection() ?? data() ?? EMPTY_TREE)
    const ids = computed(() => treeViewIds(instance()))
    // Sound: every key of the defaults is present; a partial override only replaces some.
    const messages = computed(
      () => ({ ...treeViewMessages, ...this.messages() }) as TreeViewMessages,
    )
    this.texts = messages
    const { view, send, service } = injectMachine(
      treeViewMachine,
      () => ({
        tree: tree(),
        ids: { list: ids().tree, item: ids().item },
        selectionMode: this.selectionMode(),
        selectionBehavior: this.selectionBehavior(),
        disallowEmptySelection:
          this.selectionMode() === "multiple" ? this.disallowEmptySelection() : undefined,
        focusableWhenDisabled: this.focusableWhenDisabled(),
        loop: this.loop(),
        typeaheadTimeout: this.typeaheadTimeout(),
        checkable: this.checkable(),
        checkPropagation: this.checkPropagation(),
        expandOnClick: this.expandOnClick(),
        disabled: this.disabled(),
        messages: messages(),
        ...(this.value() === undefined ? {} : { value: this.value() as TreeViewValue }),
        defaultValue:
          (this.defaultValue() as TreeViewValue | undefined) ??
          (this.selectionMode() === "multiple" ? [] : null),
        onValueChange: (v: TreeViewValue, details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          this.valueChangeDetails.emit({
            value: v as Value,
            details: { reason: e.type, key: e.key },
          })
          this.valueChange.emit(v as Value)
        },
        ...(this.expandedValue() !== undefined ? { expandedValue: this.expandedValue() } : {}),
        defaultExpandedValue: this.defaultExpandedValue() ?? [],
        onExpandedValueChange: (keys: readonly string[], details: { event: { type: string } }) => {
          this.expandedChangeDetails.emit({
            value: keys,
            details: { reason: expansionReason(details.event.type as never) },
          })
          this.expandedValueChange.emit(keys)
        },
        ...(this.checkedValue() !== undefined ? { checkedValue: this.checkedValue() } : {}),
        defaultCheckedValue: this.defaultCheckedValue() ?? [],
        onCheckedValueChange: (keys: readonly string[], details: { event: unknown }) => {
          const e = details.event as { type: string; key?: string }
          this.checkedChangeDetails.emit({ value: keys, details: { reason: e.type, key: e.key } })
          this.checkedValueChange.emit(keys)
        },
        onAction: this.onAction()
          ? (key: string, d: TreeViewActionDetails) => untracked(this.onAction)?.(key, d)
          : undefined,
        onLoadChildren: this.onLoadChildren()
          ? (key: string, o: { readonly signal: AbortSignal }) =>
              untracked(this.onLoadChildren)?.(key, o)
          : undefined,
        virtualized: this.virtualized(),
        scrollToIndex: this.scrollToIndex()
          ? (d: ScrollToIndexDetails) => untracked(this.scrollToIndex)?.(d)
          : undefined,
        movable: this.movable(),
        onMove: this.onMove()
          ? (key: string, d: TreeViewMoveDetails) => untracked(this.onMove)?.(key, d)
          : undefined,
      }),
      env,
    )
    this.canMove = (key) =>
      isMovable({ movable: untracked(this.movable), disabled: untracked(this.disabled) }, key)
    const focused = () => view().matches("focused")
    this.focused = focused
    const modality = injectModality(env.modality, focused)
    const expandedKeys = computed(
      () => view().values.expandedValue as readonly string[] | undefined,
    )
    const visible = computed(() => visibleOf(tree(), expandedKeys()))
    this.visible = visible
    this.parts = computed(() => {
      const ctx = view().context
      const selectionMode = this.checkable() ? "none" : this.selectionMode()
      return treeViewConnect(
        {
          instance: instance(),
          tree: tree(),
          visible: visible(),
          expanded: keySetOf(expandedKeys()),
          context: {
            highlightedKey: ctx.highlightedKey,
            highlightSource: ctx.highlightSource,
            loading: ctx.loading,
            failed: ctx.failed,
          },
          selection: treeSelectionOf(
            view().values.value as TreeViewValue | undefined,
            selectionMode,
          ),
          selectionMode,
          checkable: this.checkable(),
          checked: keySetOf(view().values.checkedValue as readonly string[] | undefined),
          checkPropagation: this.checkPropagation() ?? "both",
          disabled: this.disabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          typingAhead: () => {
            const t = service().getSnapshot().context.typeahead
            return (
              t.buffer !== "" &&
              env.clock.now() - t.at <= (untracked(this.typeaheadTimeout) ?? 1000)
            )
          },
          focused: focused(),
          modality: modality(),
          hovered: this.hovered(),
          pressed: this.pressed(),
          mounted: {
            label: this.label(),
            empty: this.empty(),
            itemText: (key: CollectionKey) => this.itemTexts().has(key),
          },
          send,
          canMove: (key: CollectionKey) =>
            isMovable({ movable: this.movable(), disabled: this.disabled() }, key),
          movable: this.movable() !== undefined && this.movable() !== false,
          drag: ctx.drag,
          moveInstructions: messages().moveInstructions,
        },
        env,
      )
    })
    const node = (key: CollectionKey): TreeViewNodeState | undefined => {
      const n = tree().get(key)
      if (!n) return undefined
      const item = this.parts().item(key)
      return {
        key,
        index: visible().get(key)?.index ?? -1,
        value: n.value,
        label: n.textValue,
        level: n.level + 1,
        posInSet: n.setIndex + 1,
        setSize: n.setSize,
        isLast: n.setIndex === n.setSize - 1,
        parentKey: n.parentKey,
        isBranch: n.hasChildren,
        expanded: n.hasChildren && keySetOf(expandedKeys()).has(key),
        selected: item["aria-selected"] === "true",
        checked: item["aria-checked"] as "true" | "false" | "mixed" | undefined,
        loading: view().context.loading.has(key),
        disabled: n.disabled,
      }
    }
    this.node = node
    this.visibleRows = computed(() => {
      const k = view().context.highlightedKey
      const index = k === null ? undefined : visible().get(k)?.index
      return { count: visible().size, persistedIndexes: index === undefined ? [] : [index] }
    })
    const dropAt = this.dropAt
    this.startDrag = (key, event) => {
      const treeEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('[role="tree"]')
      if (!treeEl || (event.pointerType === "mouse" && event.button !== 0)) return
      let auto: { key: CollectionKey; timer: ReturnType<typeof env.scheduler.setTimeout> } | null =
        null
      const stopAuto = () => {
        if (auto) env.scheduler.clearTimeout(auto.timer)
        auto = null
      }
      treeDrag(event, {
        tree: treeEl,
        onStart: () => send({ type: "DRAG.START", key }),
        onOver: (row, fraction) => {
          // The latest tree and expansion: a branch may have opened during the drag.
          const raw = row?.getAttribute("data-key")
          const over = raw ? toKey(raw) : null
          const n = over === null ? undefined : untracked(() => node(over))
          if (over === null || !n || !row) {
            stopAuto()
            dropAt.set(null)
            send({ type: "DRAG.OVER", over: null, zone: null, target: null })
            return
          }
          const zone: TreeDropZone =
            fraction < 0.25
              ? "before"
              : fraction > 0.75
                ? "after"
                : n.isBranch
                  ? "inside"
                  : fraction < 0.5
                    ? "before"
                    : "after"
          const target = pointerTarget(untracked(tree), key, over, zone, n.expanded)
          send({ type: "DRAG.OVER", over, zone, target })
          // A collapsed branch held over its middle opens (a drop inside it can then be aimed).
          if (zone === "inside" && n.isBranch && !n.expanded && target) {
            if (auto?.key !== over) {
              stopAuto()
              auto = {
                key: over,
                timer: env.scheduler.setTimeout(() => send({ type: "EXPAND", key: over }), 700),
              }
            }
          } else stopAuto()
          if (!target || zone === "inside") {
            dropAt.set(null)
            return
          }
          const box = row.getBoundingClientRect()
          const parent =
            target.parent === null
              ? undefined
              : untracked(() => node(toKey(target.parent as string)))
          dropAt.set({
            top: (zone === "before" ? box.top : box.bottom) - treeEl.getBoundingClientRect().top,
            level: parent ? parent.level + 1 : 1,
          })
        },
        onEnd: (drop) => {
          stopAuto()
          dropAt.set(null)
          send(drop ? { type: "DRAG.END" } : { type: "DRAG.CANCEL" })
        },
      })
    }
    // The move instructions (the tree's description), after the content as React renders them.
    // Created once this Root exists (it injects it), in the first render, the server's too.
    const container = inject(ViewContainerRef)
    const injector = inject(Injector)
    let created = false
    effect(() => {
      if (created) return
      created = true
      untracked(() => container.createComponent(TreeViewMoveInstructions, { injector }))
    })
  }

  /** @internal */
  mountLabel(on: boolean): void {
    this.label.set(on)
  }
  /** @internal */
  mountEmpty(on: boolean): void {
    this.empty.set(on)
  }
  /** @internal */
  mountText(key: CollectionKey, on: boolean): void {
    const now = untracked(this.itemTexts)
    if (now.has(key) === on) return
    const next = new Set(now)
    if (on) next.add(key)
    else next.delete(key)
    this.itemTexts.set(next)
  }
  /** @internal */
  setHovered(key: CollectionKey | null): void {
    this.hovered.set(key)
  }
  /** @internal */
  setPressed(key: CollectionKey | null): void {
    this.pressed.set(key)
  }
}

/** The move instructions a movable tree renders after its content; hidden otherwise. */
@Component({
  selector: "span[rindTreeViewMoveInstructions]",
  encapsulation: ViewEncapsulation.None,
  template: "{{ text() }}",
})
export class TreeViewMoveInstructions {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const host = injectHost("Root")
    const movable = () => {
      const m = host.movable()
      return m !== undefined && m !== false
    }
    this.text = computed(() => (movable() ? host.parts().moveInstructionsText : ""))
    bindProps(() =>
      movable() ? host.parts().moveInstructions() : absentProps("tree-view", host.instance()),
    )
  }
}

@Directive({ selector: "[rindTreeViewLabel]", exportAs: "rindTreeViewLabel" })
export class TreeViewLabel {
  constructor() {
    const host = injectHost("Label")
    bindProps(() => host.parts().label())
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => host.mountLabel(true))
    inject(DestroyRef).onDestroy(() => host.mountLabel(false))
  }
}

/** A loading branch's row (the default the Tree renders after it). */
@Directive({ selector: "[rindTreeViewLoading]", exportAs: "rindTreeViewLoading" })
export class TreeViewLoading {
  constructor() {
    const host = injectHost("Loading")
    bindProps(() => host.parts().loading())
  }
}

/** Marks the Tree's row template: `<ng-template rindTreeViewRow let-node>`. */
@Directive({ selector: "ng-template[rindTreeViewRow]" })
export class TreeViewRowTemplate {
  readonly template = inject(TemplateRef<{ $implicit: TreeViewNodeState }>)
}

/** Marks the template a loading branch is followed by: `<ng-template rindTreeViewLoadingRow let-node>`. */
@Directive({ selector: "ng-template[rindTreeViewLoadingRow]" })
export class TreeViewLoadingRowTemplate {
  readonly template = inject(TemplateRef<{ $implicit: TreeViewNodeState }>)
}

/**
 * The tree: `<div rindTreeViewTree>`. Its `<ng-template rindTreeViewRow let-node>` renders one
 * visible node, in order, as a flat list; a loading branch is followed by its
 * `rindTreeViewLoadingRow` template (else a Loading row with the message).
 */
@Component({
  selector: "[rindTreeViewTree]",
  exportAs: "rindTreeViewTree",
  imports: [NgTemplateOutlet, TreeViewLoading],
  encapsulation: ViewEncapsulation.None,
  template: `@for (key of keys(); track key) {@if (host.node(key); as node) {@if (rowTemplate(); as row) {<ng-container
          *ngTemplateOutlet="row.template; context: { $implicit: node }"
        />}@if (node.loading) {@if (loadingTemplate(); as l) {<ng-container
            *ngTemplateOutlet="l.template; context: { $implicit: node }"
          />} @else {<span rindTreeViewLoading>{{ host.texts().loadingLabel }}</span>}}}}`,
})
export class TreeViewTree {
  /**
   * Virtualized: the visible-list indexes to render (a virtualizer's window plus the Root's
   * `visibleRows().persistedIndexes`). Default: every visible node.
   */
  readonly indexes = input<readonly number[]>()
  /** @internal */
  protected readonly host = injectHost("Tree")
  /** @internal */
  protected readonly rowTemplate = contentChild(TreeViewRowTemplate)
  /** @internal */
  protected readonly loadingTemplate = contentChild(TreeViewLoadingRowTemplate)
  /** @internal */
  protected readonly keys: Signal<readonly CollectionKey[]>

  constructor() {
    const host = this.host
    const el: Element = inject(ElementRef).nativeElement
    this.keys = computed(() => {
      const visible = host.visible()
      const out: CollectionKey[] = []
      const add = (index: number) => {
        const node = visible.at(index)
        if (node) out.push(node.key)
      }
      const indexes = this.indexes()
      if (indexes) for (const index of indexes) add(index)
      else for (let index = 0; index < visible.size; index++) add(index)
      return out
    })
    let naming = {}
    const { statics } = bindProps(() => host.parts().tree(naming), { owns: ["indexes"] })
    const label = statics.get("aria-label")
    const labelledBy = statics.get("aria-labelledby")
    naming = {
      ...(label === undefined ? {} : { "aria-label": label }),
      ...(labelledBy === undefined ? {} : { "aria-labelledby": labelledBy }),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    // A moved node keeps its focus (Alt+arrows reorder the rows under it; a DOM move blurs it).
    let focused: HTMLElement | null = null
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      const onFocusIn = (e: Event) => {
        if (e.target instanceof HTMLElement) focused = e.target
      }
      el.addEventListener("focusin", onFocusIn)
      destroy.onDestroy(() => el.removeEventListener("focusin", onFocusIn))
    })
    afterEveryRender(() => {
      const f = focused
      if (!f?.isConnected) return
      const active = f.ownerDocument.activeElement
      if (active !== f && (active === null || active === f.ownerDocument.body))
        f.focus({ preventScroll: true })
    })
    // After the render a Label's registration causes, not on the first one.
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect(() => {
      if (!ready()) return
      const o = { checkable: host.checkable(), selectionMode: host.selectionMode() }
      queueMicrotask(() => {
        if (el instanceof HTMLElement && el.isConnected) checkTreeView(el, o)
      })
    })
  }
}

/**
 * A node's row: `<div rindTreeViewItem [value]="node.key">`, or a link node's
 * `<a rindTreeViewItem [value]="node.key" href="…">` (a native `<a role="treeitem">`).
 */
@Directive({
  selector: "[rindTreeViewItem]",
  exportAs: "rindTreeViewItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => TreeViewItem) }],
})
export class TreeViewItem {
  /** The node key. */
  readonly value = input.required<string>()
  /** On an `<a>`: the link (link navigation). */
  readonly href = input<Href>()
  /** With `href`: passed to the anchor; not `_self` opens elsewhere. */
  readonly target = input<string>()
  /** With `href`: passed to the anchor. */
  readonly rel = input<string>()
  /** With `href`: sets `aria-current` and `data-current`; the link still navigates. */
  readonly current = input<LinkCurrent>()
  /** With `href`: passed unchanged to the router's `navigate`. */
  readonly routerOptions = input<RouterOptions>()
  /** @internal */
  readonly key = computed(() => toKey(this.value()))

  constructor() {
    const host = injectHost("Item")
    const el: Element = inject(ElementRef).nativeElement
    const origin = signal<string | undefined>(undefined)
    bindProps(
      () => {
        const k = this.key()
        const own = host.parts().item(k)
        const wiring = {
          onPointerEnter: () => host.setHovered(k),
          onPointerLeave: () => host.setHovered(null),
          onPointerDown: (e: PointerEvent) => {
            host.setPressed(k)
            if (host.canMove(k)) host.startDrag(k, e)
          },
          onPointerUp: () => host.setPressed(null),
          onPointerCancel: () => host.setPressed(null),
        }
        const href = this.href()
        if (href === undefined) return joinHandlers(own, wiring)
        const link = linkProps(
          {
            href,
            target: this.target(),
            rel: this.rel(),
            current: this.current(),
            routerOptions: this.routerOptions(),
            tag: "a",
            origin: origin(),
          },
          host.env,
        )
        // The tree's roving tabindex and role win over the link's.
        return joinHandlers(link, own, wiring)
      },
      { owns: ["current", "href", "rel", "routeroptions", "target", "value"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => {
      origin.set(globalThis.location?.origin)
      ready.set(true)
    })
    // Virtualized: a row highlighted by a key press renders after the scroll. Focus left on the
    // tree, on the previous row, or dropped to the body when that row went moves to it.
    effect(() => {
      if (!ready()) return
      const highlighted = host.parts().item(this.key())["data-highlighted"] !== undefined
      if (!(el instanceof HTMLElement) || !highlighted || !host.focused()) return
      const doc = el.ownerDocument
      const active = doc.activeElement
      if (active === el) return
      const treeEl = el.closest('[role="tree"]')
      const dropped = active === null || active === doc.body
      const inTree =
        active !== null &&
        treeEl !== null &&
        (active === treeEl ||
          (active.getAttribute("role") === "treeitem" &&
            active.closest('[role="tree"]') === treeEl))
      if (dropped || inTree) el.focus({ preventScroll: true })
    })
  }
}

/** The drop line of a pointer drag: render it beside the Tree in a positioned wrapper. */
@Directive({ selector: "[rindTreeViewDropIndicator]", exportAs: "rindTreeViewDropIndicator" })
export class TreeViewDropIndicator {
  constructor() {
    const host = injectHost("DropIndicator")
    bindProps(() => host.parts().dropIndicator(host.dropAt()))
  }
}

@Directive({ selector: "[rindTreeViewItemText]", exportAs: "rindTreeViewItemText" })
export class TreeViewItemText {
  constructor() {
    const key = injectItemKey("ItemText")
    const host = injectHost("ItemText")
    bindProps(() => host.parts().itemText(key()))
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const k = key()
      untracked(() => host.mountText(k, true))
      onCleanup(() => untracked(() => host.mountText(k, false)))
    })
  }
}

/** A branch's expand indicator (`data-state` open / closed). */
@Directive({ selector: "[rindTreeViewItemIndicator]", exportAs: "rindTreeViewItemIndicator" })
export class TreeViewItemIndicator {
  constructor() {
    const key = injectItemKey("ItemIndicator")
    const host = injectHost("ItemIndicator")
    bindProps(() => host.parts().itemIndicator(key()))
  }
}

/** A checkable tree's check box (decorative: the row is the checkbox). */
@Directive({ selector: "[rindTreeViewItemCheckbox]", exportAs: "rindTreeViewItemCheckbox" })
export class TreeViewItemCheckbox {
  constructor() {
    const key = injectItemKey("ItemCheckbox")
    const host = injectHost("ItemCheckbox")
    bindProps(() => host.parts().itemCheckbox(key()))
  }
}

/** Shown while the tree is empty: its content, or the message. */
@Component({
  selector: "[rindTreeViewEmpty]",
  exportAs: "rindTreeViewEmpty",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ label() }}</ng-content>",
})
export class TreeViewEmpty {
  /** @internal */
  protected readonly label: Signal<string>
  constructor() {
    const host = injectHost("Empty")
    this.label = computed(() => host.texts().emptyLabel)
    bindProps(() =>
      host.parts().isEmpty ? host.parts().empty() : absentProps("tree-view", host.instance()),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    // The flag, not the parts: mounting changes the parts.
    const isEmpty = computed(() => host.parts().isEmpty)
    effect((onCleanup) => {
      if (!ready() || !isEmpty()) return
      untracked(() => host.mountEmpty(true))
      onCleanup(() => untracked(() => host.mountEmpty(false)))
    })
  }
}

/** The Tree View's parts, for a standalone component's `imports`. */
export const TreeView = [
  TreeViewRoot,
  TreeViewLabel,
  TreeViewLoading,
  TreeViewTree,
  TreeViewRowTemplate,
  TreeViewLoadingRowTemplate,
  TreeViewItem,
  TreeViewDropIndicator,
  TreeViewItemText,
  TreeViewItemIndicator,
  TreeViewItemCheckbox,
  TreeViewEmpty,
] as const
