import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
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
} from "@angular/core"
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  type InactivePanels,
  layoutCapability,
  observeTabbable,
  type TabsEvent,
  tabsConnect,
  tabsIds,
  tabsMachine,
  toKey,
  untilFound,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { declaredStop, injectCollectionItems, injectRegisterItem } from "../collection-items"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"
import { injectSelectionIndicator } from "../selection-indicator"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

export interface TabsState {
  readonly value: string | null
  readonly orientation: "horizontal" | "vertical"
}
export interface TabsTabState {
  readonly selected: boolean
  readonly disabled: boolean
}

const TABS = new InjectionToken<TabsRoot>("rind-ui.tabs")

function injectTabs(part: string): TabsRoot {
  const root = inject(TABS, { optional: true })
  if (!root) throw new Error(`rindTabs${part} must be inside rindTabsRoot`)
  return root
}

/**
 * Tabs: `<div rindTabsRoot [(value)]="tab">` with a `<div rindTabsList aria-label="…">` of
 * `<button rindTabsTab value="…">` and one `<div rindTabsPanel value="…">` per tab.
 */
@Directive({
  selector: "[rindTabsRoot]",
  exportAs: "rindTabsRoot",
  providers: [{ provide: TABS, useExisting: forwardRef(() => TabsRoot) }],
})
export class TabsRoot {
  /** Controlled selected tab (`[(value)]`); `null` selects none. */
  readonly value = input<string | null>()
  readonly defaultValue = input<string | null>()
  /** `automatic` (default): arrows select; `manual`: Enter or Space selects. */
  readonly activationMode = input<"automatic" | "manual">("automatic")
  readonly orientation = input<"horizontal" | "vertical">("horizontal")
  /** Arrow moves wrap at both ends (default true). */
  readonly loop = input(true, { transform: booleanAttribute })
  /** How inactive panels are hidden (default `unmount`: React removes them). */
  readonly inactivePanels = input<InactivePanels>("unmount")
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled tabs stay reachable by arrows (never selectable). */
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  readonly id = input<string>()
  /** Every selection proposes a value; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ChangeEvent<string | null, TabsEvent>>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<string | null>()

  private readonly emit = changeEmitter<string | null, TabsEvent>(
    this.valueChangeDetails,
    this.valueChange,
  )
  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly api: (pendingStop?: string | null) => ReturnType<typeof tabsConnect>
  /** @internal */
  readonly send: (event: TabsEvent) => void
  /** @internal */
  readonly registry: ReturnType<typeof injectCollectionItems>["registry"]
  /** @internal */
  readonly collection: () => unknown
  /** @internal */
  readonly current: () => string | null
  /** @internal */
  readonly stop = declaredStop()
  /** @internal The tabs whose props applied before the tabs registered (server render). */
  readonly declared = new Set<string>()
  /** @internal A panel element is rendered for `key` (aria-controls). */
  readonly registerPanel: (key: string) => () => void
  /** The tabs' state, for the template (`#t="rindTabsRoot"`, `t.state()`). */
  readonly state: Signal<TabsState>

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = this.instance
    const ids = computed(() => {
      const t = tabsIds(instance())
      return { list: t.list, item: t.tab }
    })
    const { collection: registered, registry } = injectCollectionItems()
    this.registry = registry
    this.collection = registered
    const collection = () => registered() ?? EMPTY
    const { view, send } = injectMachine(
      tabsMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids(),
        loop: this.loop(),
        focusableWhenDisabled: this.focusableWhenDisabled(),
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: this.emit,
        activationMode: this.activationMode(),
        disabled: this.disabled(),
      }),
      env,
    )
    this.send = send
    const current = () => view().values.value ?? null
    this.current = current
    const panels = signal<ReadonlySet<string>>(new Set())
    this.registerPanel = (key) => {
      if (!panels().has(key)) panels.set(new Set(panels()).add(key))
      return () => {
        if (!panels().has(key)) return
        const next = new Set(panels())
        next.delete(key)
        panels.set(next)
      }
    }
    // Until the tabs register (server render, hydration), each tab's panel is assumed declared.
    // ponytail: a tab without a panel still gets aria-controls in the server HTML; it goes once
    // the tabs register.
    const pendingPanels = (): ReadonlySet<string> => {
      if (this.inactivePanels() !== "unmount") return this.declared
      const now = current()
      return new Set(now === null ? [] : [now])
    }
    this.api = (pendingStop: string | null = null) =>
      tabsConnect(
        {
          instance: instance(),
          collection: collection(),
          value: current(),
          highlightedKey: view().context.highlightedKey,
          pending: registered() === null,
          pendingStop,
          orientation: this.orientation(),
          activationMode: this.activationMode(),
          inactivePanels: this.inactivePanels(),
          disabled: this.disabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          focusWithin: view().matches("focused"),
          renderedPanels: registered() === null ? pendingPanels() : panels(),
          panelTabbable: view().context.panelTabbable,
          direction: view().context.direction,
          indicator: view().context.indicator,
          revealed: view().context.revealed,
        },
        send,
        env,
      )
    this.state = computed(() => ({ value: current(), orientation: this.orientation() }))
    bindProps(() => this.api().root(), {
      owns: [
        "activationmode",
        "defaultvalue",
        "disabled",
        "focusablewhendisabled",
        "id",
        "inactivepanels",
        "loop",
        "orientation",
        "value",
      ],
    })
  }
}

/** The tablist; it needs a name (`aria-label` or `aria-labelledby`). */
@Directive({ selector: "[rindTabsList]", exportAs: "rindTabsList" })
export class TabsList {
  constructor() {
    const root = injectTabs("List")
    bindProps(() => root.api().list())
    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    // Development: a tablist needs a name (aria-label or aria-labelledby).
    let warned = false
    afterEveryRender(() => {
      if (process.env.NODE_ENV === "production" || warned) return
      if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
        warned = true
        console.warn(
          `[rind-ui] tabs: the list #${el.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    })
  }
}

/** A tab: `<button rindTabsTab value="billing">Billing</button>`. */
@Directive({ selector: "[rindTabsTab]", exportAs: "rindTabsTab" })
export class TabsTab {
  /** The key pairing this tab with its panel. */
  readonly value = input.required<string>()
  /** Disables this tab: it is never selected. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The text for the collection (defaults to the tab's text content). */
  readonly textValue = input<string>()
  /** The tab's state, for the template (`#t="rindTabsTab"`, `t.state()`). */
  readonly state: Signal<TabsTabState>

  constructor() {
    const root = injectTabs("Tab")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const key = (): CollectionKey => toKey(this.value())
    injectRegisterItem(
      root.registry,
      () => ({ key: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      el,
    )
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const isDisabled = () => root.disabled() || this.disabled()
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") root.send({ type: "PRESS", key: key(), modality: e.modality })
      },
      disabled: isDisabled,
    })
    const hover = injectHover({ env, send: () => {}, disabled: isDisabled })
    this.state = computed(() => ({ selected: root.current() === key(), disabled: isDisabled() }))
    const pendingStop = () => {
      root.declared.add(this.value())
      const now = root.current()
      return root.stop(this.value(), isDisabled(), now === null ? [] : [now])
    }
    bindProps(
      () =>
        joinHandlers(
          root.api(pendingStop()).tab(key(), {
            tag,
            itemDisabled: this.disabled(),
            focused: focused(),
            modality: modality(),
            pressed: press.pressed(),
            hovered: hover.hovered(),
          }),
          press.props,
          hover.props,
          { onFocusIn: () => focused.set(true), onFocusOut: () => focused.set(false) },
        ),
      { owns: ["disabled", "textvalue", "value"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The modality tracker must see the pointerdown that comes before focus.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/**
 * A tab's panel: `<div rindTabsPanel value="billing">`. Inactive, it is removed in React
 * (`inactivePanels="unmount"`, the default): here it stays as a hidden, empty-of-attributes
 * element; project its content with `@if (t.state().value === 'billing')` to drop it too.
 */
@Directive({ selector: "[rindTabsPanel]", exportAs: "rindTabsPanel" })
export class TabsPanel {
  /** The key of the tab this panel belongs to. */
  readonly value = input.required<string>()
  /** The panel's state, for the template (`#p="rindTabsPanel"`, `p.selected()`). */
  readonly selected: Signal<boolean>

  constructor() {
    const root = injectTabs("Panel")
    const env = injectEnvironment()
    const key = (): CollectionKey => toKey(this.value())
    const selected = computed(() => root.current() === key())
    this.selected = selected
    // connect's panelRendered, without reading the rendered panels (registering one changes them).
    const rendered = computed(() => root.inactivePanels() !== "unmount" || selected())
    bindProps(() => (rendered() ? root.api().panel(key()) : absentProps("tabs", root.instance())), {
      owns: ["value"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    // Registered while rendered (aria-controls on the tab); the registry is not a dependency.
    effect((onCleanup) => {
      if (!ready() || !rendered()) return
      const value = this.value()
      const unregister = untracked(() => root.registerPanel(value))
      onCleanup(() => untracked(unregister))
    })
    // A visible panel without tabbable content is itself a tab stop (re-evaluated live).
    effect((onCleanup) => {
      if (!ready() || !selected()) return
      const k = key()
      // Untracked: the first report is synchronous, and the machine's state is no dependency.
      const stop = untracked(() =>
        observeTabbable(el, (tabbable) => root.send({ type: "PANEL.TABBABLE", key: k, tabbable })),
      )
      onCleanup(stop)
    })
    // until-found: imperative, re-applied after every render; beforematch selects the tab.
    let finder: ReturnType<typeof untilFound> | null = null
    effect((onCleanup) => {
      if (!ready() || root.inactivePanels() !== "until-found" || !(el instanceof HTMLElement))
        return
      const k = key()
      const h = untracked(() =>
        untilFound(el, {
          scheduler: env.scheduler,
          isOpen: () => root.current() === k,
          onReveal: () => root.send({ type: "find-in-page", key: k }),
        }),
      )
      finder = h
      onCleanup(() => {
        h.dispose()
        finder = null
      })
    })
    afterEveryRender(() => finder?.sync())
  }
}

/** Slides under the selected tab (`--rind-indicator-*`); put it inside the List. */
@Directive({ selector: "[rindTabsIndicator]", exportAs: "rindTabsIndicator" })
export class TabsIndicator {
  constructor() {
    const root = injectTabs("Indicator")
    injectSelectionIndicator({
      selectedId: () => {
        const value = root.current()
        return value === null ? null : tabsIds(root.instance()).tab(toKey(value))
      },
      itemSelector: () => `[data-part="tab"][data-instance="${root.instance()}"]`,
      collection: root.collection,
      onMeasure: (box, cause) => root.send({ type: "INDICATOR.MEASURE", box, cause }),
    })
    bindProps(() => root.api().indicator())
  }
}

/** The Tabs' parts, for a standalone component's `imports`. */
export const Tabs = [TabsRoot, TabsList, TabsTab, TabsPanel, TabsIndicator] as const
