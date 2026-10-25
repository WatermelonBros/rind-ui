/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  type InactivePanels,
  type ItemRegistry,
  layoutCapability,
  observeTabbable,
  type TabsEvent,
  tabsConnect,
  tabsIds,
  tabsMachine,
  toKey,
  untilFound,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { declaredStop, useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useSelectionIndicator } from "../use-selection-indicator"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

interface Ctx {
  /** The connect output; `pendingStop` for a tab still unregistered (server, hydration). */
  readonly api: (pendingStop?: string | null) => ReturnType<typeof tabsConnect>
  readonly send: (event: TabsEvent) => void
  readonly registry: ItemRegistry
  readonly instance: Accessor<string>
  readonly value: Accessor<string | null>
  readonly disabled: Accessor<boolean>
  readonly inactivePanels: Accessor<InactivePanels>
  readonly orientation: Accessor<"horizontal" | "vertical">
  readonly collection: () => unknown
  /** A panel element is rendered for `key` (aria-controls). */
  readonly registerPanel: (key: string) => () => void
  readonly stop: ReturnType<typeof declaredStop>
}
const TabsContext = createContext<Ctx>()
function useTabs(part: string): Ctx {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`Tabs.${part} must be inside Tabs.Root`)
  return ctx
}

export interface TabsState {
  readonly value: string | null
  readonly orientation: "horizontal" | "vertical"
}

export type TabsRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "id"
> & {
  /** Controlled selected tab; `null` selects none. */
  readonly value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<TabsEvent>) => void)
    | undefined
  /** `automatic` (default): arrows select; `manual`: Enter or Space selects. */
  readonly activationMode?: "automatic" | "manual" | undefined
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  /** How inactive panels are hidden (default `unmount`). */
  readonly inactivePanels?: InactivePanels | undefined
  readonly disabled?: boolean | undefined
  /** Disabled tabs stay reachable by arrows (never selectable). */
  readonly focusableWhenDisabled?: boolean | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<TabsState> | undefined
  readonly children?: JSX.Element | ((state: TabsState) => JSX.Element)
}

/**
 * Stands for the set of rendered panels before the panels register (server render and
 * hydration): a panel renders for every tab (its key is the tab's) unless inactive ones unmount.
 */
class PendingPanels extends Set<string> {
  constructor(
    private readonly all: boolean,
    private readonly selected: string | null,
  ) {
    super()
  }
  override has(key: string) {
    return this.all || key === this.selected
  }
}

function Root(props: TabsRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "activationMode",
    "orientation",
    "loop",
    "inactivePanels",
    "disabled",
    "focusableWhenDisabled",
    "id",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => local.id)
  const ids = createMemo(() => {
    const t = tabsIds(instance())
    return { list: t.list, item: t.tab }
  })
  const { collection: registered, registry } = useCollectionItems()
  const collection = () => registered() ?? EMPTY
  const activationMode = () => local.activationMode ?? "automatic"
  const orientation = () => local.orientation ?? "horizontal"
  const inactivePanels = () => local.inactivePanels ?? "unmount"
  const { view, send } = useMachine(
    tabsMachine,
    () => ({
      collection: collection(),
      strategy: "roving" as const,
      ids: ids(),
      loop: local.loop ?? true,
      focusableWhenDisabled: local.focusableWhenDisabled === true,
      value: local.value,
      defaultValue: local.defaultValue,
      onValueChange: local.onValueChange,
      activationMode: activationMode(),
      disabled: local.disabled === true,
    }),
    env,
  )
  const current = (): string | null => view().values.value ?? null
  const [panels, setPanels] = createSignal<ReadonlySet<string>>(new Set())
  const registerPanel = (key: string) => {
    // Untracked: called inside the Panel's effect, which must not depend on the set it writes.
    if (!untrack(panels).has(key)) setPanels((p) => new Set(p).add(key))
    return () => {
      if (!untrack(panels).has(key)) return
      setPanels((p) => {
        const next = new Set(p)
        next.delete(key)
        return next
      })
    }
  }
  const api = (pendingStop: string | null = null) =>
    tabsConnect(
      {
        instance: instance(),
        collection: collection(),
        value: current(),
        highlightedKey: view().context.highlightedKey,
        pending: registered() === null,
        pendingStop,
        orientation: orientation(),
        activationMode: activationMode(),
        inactivePanels: inactivePanels(),
        disabled: local.disabled === true,
        focusableWhenDisabled: local.focusableWhenDisabled === true,
        focusWithin: view().matches("focused"),
        renderedPanels:
          registered() === null
            ? new PendingPanels(inactivePanels() !== "unmount", current())
            : panels(),
        panelTabbable: view().context.panelTabbable,
        direction: view().context.direction,
        indicator: view().context.indicator,
        revealed: view().context.revealed,
      },
      send,
      env,
    )
  const state = reactive<TabsState>(() => ({ value: current(), orientation: orientation() }))
  const merged = createMemo(() => mergeProps(normalizeProps(api().root()), rest))
  const children = () => resolveChildren(local.children, state)
  return (
    <TabsContext.Provider
      value={{
        api,
        send,
        registry,
        instance,
        value: current,
        disabled: () => local.disabled === true,
        inactivePanels,
        orientation,
        collection: registered,
        registerPanel,
        stop: declaredStop(),
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </TabsContext.Provider>
  )
}

export type TabsListProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly render?: RenderProp<TabsState> | undefined
  readonly children?: JSX.Element | ((state: TabsState) => JSX.Element)
}

function List(props: TabsListProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTabs("List")
  const [el, setEl] = createSignal<Element | null>(null)
  // Development: a tablist needs a name (aria-label or aria-labelledby).
  afterMount(() =>
    createEffect(() => {
      const node = el()
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] tabs: the list #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    }),
  )
  const state = reactive<TabsState>(() => ({
    value: ctx.value(),
    orientation: ctx.orientation(),
  }))
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().list()), ref: setEl }, rest),
  )
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

export interface TabsTabState {
  readonly selected: boolean
  readonly disabled: boolean
}

export type TabsTabProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "value"
> & {
  /** The key pairing this tab with its panel. */
  readonly value: string
  /** Disables this tab: it is never selected. */
  readonly disabled?: boolean | undefined
  /** The text for the collection (defaults to the tab's text content). */
  readonly textValue?: string | undefined
  readonly render?: RenderProp<TabsTabState> | undefined
  readonly children?: JSX.Element | ((state: TabsTabState) => JSX.Element)
}

function Tab(props: TabsTabProps) {
  const [local, rest] = splitProps(props, ["value", "disabled", "textValue", "render", "children"])
  const ctx = useTabs("Tab")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const key = (): CollectionKey => toKey(local.value)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "button") : "button")
  const ownDisabled = () => local.disabled === true
  useRegisterItem(
    ctx.registry,
    () => ({ key: local.value, textValue: local.textValue, disabled: ownDisabled() }),
    el,
  )
  // Read once, in document order: this tab's view of the server tab stop.
  const current = untrack(ctx.value)
  const pendingStop = ctx.stop(
    local.value,
    untrack(ctx.disabled) || ownDisabled(),
    current === null ? [] : [current],
  )
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const isDisabled = () => ctx.disabled() || ownDisabled()
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key: key(), modality: e.modality })
    },
    disabled: isDisabled,
  })
  const hover = useHover({ env, send: () => {}, disabled: isDisabled })
  const state = reactive<TabsTabState>(() => ({
    selected: ctx.value() === key(),
    disabled: isDisabled(),
  }))
  const own = createMemo(() =>
    normalizeProps(
      ctx.api(pendingStop).tab(key(), {
        tag: tag(),
        itemDisabled: ownDisabled(),
        focused: focused(),
        modality: modality(),
        pressed: press.pressed(),
        hovered: hover.hovered(),
      }),
    ),
  )
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(own(), press.props, hover.props, {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type TabsPanelProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The key of the tab this panel belongs to. */
  readonly value: string
  readonly render?: RenderProp<{ readonly selected: boolean }> | undefined
  readonly children?: JSX.Element | ((state: { readonly selected: boolean }) => JSX.Element)
}

function Panel(props: TabsPanelProps) {
  const [local, rest] = splitProps(props, ["value", "render", "children"])
  const ctx = useTabs("Panel")
  const env = useEnvironment()
  const key = (): CollectionKey => toKey(local.value)
  const selected = createMemo(() => ctx.value() === key())
  // A memo: the api also reads the registered panels, which this part's registration changes.
  const rendered = createMemo(() => ctx.api().panelRendered(key()))
  const [el, setEl] = createSignal<Element | null>(null)
  afterMount(() => {
    // Registered while rendered (aria-controls on the tab).
    createEffect(() => {
      const value = local.value
      if (rendered()) onCleanup(ctx.registerPanel(value))
    })
    // A visible panel without tabbable content is itself a tab stop (re-evaluated live).
    createEffect(() => {
      const node = el()
      const k = key()
      if (!node || !selected()) return
      onCleanup(
        observeTabbable(node, (tabbable) => ctx.send({ type: "PANEL.TABBABLE", key: k, tabbable })),
      )
    })
    // until-found: imperative, re-applied after every update; beforematch selects the tab.
    let finder: ReturnType<typeof untilFound> | null = null
    createEffect(() => {
      const findable = ctx.inactivePanels() === "until-found"
      const node = el()
      const k = key()
      if (!findable || !(node instanceof HTMLElement)) return
      const h = untilFound(node, {
        scheduler: env.scheduler,
        isOpen: () => untrack(selected),
        onReveal: () => ctx.send({ type: "find-in-page", key: k }),
      })
      finder = h
      onCleanup(() => {
        h.dispose()
        finder = null
      })
    })
    createEffect(() => {
      selected()
      rendered()
      el()
      finder?.sync()
    })
  })
  const state = reactive(() => ({ selected: selected() }))
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().panel(key())), ref: setEl }, rest),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <Show when={rendered()}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </Show>
  )
}

export type TabsIndicatorProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly render?: RenderProp<{ readonly visible: boolean }> | undefined
  readonly children?: JSX.Element | ((state: { readonly visible: boolean }) => JSX.Element)
}

function Indicator(props: TabsIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTabs("Indicator")
  const [el, setEl] = createSignal<Element | null>(null)
  useSelectionIndicator({
    el,
    selectedId: () => {
      const value = ctx.value()
      return value === null ? null : tabsIds(ctx.instance()).tab(toKey(value))
    },
    itemSelector: `[data-part="tab"][data-instance="${untrack(ctx.instance)}"]`,
    collection: ctx.collection,
    onMeasure: (box, cause) => ctx.send({ type: "INDICATOR.MEASURE", box, cause }),
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().indicator()), ref: setEl }, rest),
  )
  const state = reactive(() => ({ visible: merged()["data-state"] === "visible" }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <span {...p}>{children()}</span>)
}

/** The parts, by name: `tabs.parts.ts` re-exports them as the `Tabs` namespace. */
export { Indicator, List, Panel, Root, Tab }
