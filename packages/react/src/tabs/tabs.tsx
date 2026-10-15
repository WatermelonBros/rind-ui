import {
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  type InactivePanels,
  observeTabbable,
  selectionIndicator,
  type TabsEvent,
  tabsConnect,
  tabsIds,
  tabsMachine,
  toKey,
  untilFound,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { declaredItems, serverStop } from "../declared-items"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

interface Ctx {
  readonly api: ReturnType<typeof tabsConnect>
  readonly send: (event: TabsEvent) => void
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly instance: string
  readonly value: string | null
  readonly disabled: boolean
  readonly inactivePanels: InactivePanels
  readonly orientation: "horizontal" | "vertical"
  readonly collection: ReturnType<typeof useCollectionItems>["collection"]
  /** A panel element is rendered for `key` (aria-controls). */
  readonly registerPanel: (key: string) => () => void
}
const TabsContext = createContext<Ctx | null>(null)
function useTabs(part: string): Ctx {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`Tabs.${part} must be inside Tabs.Root`)
  return ctx
}

export interface TabsState {
  readonly value: string | null
  readonly orientation: "horizontal" | "vertical"
}

export type TabsRootProps = Omit<ComponentPropsWithRef<"div">, "children" | "defaultValue"> & {
  readonly children?: ReactNode
  /** Controlled selected tab; `null` selects none. */
  readonly value?: string | null
  readonly defaultValue?: string | null
  readonly onValueChange?: (value: string | null, details: ChangeDetails<TabsEvent>) => void
  /** `automatic` (default): arrows select; `manual`: Enter or Space selects. */
  readonly activationMode?: "automatic" | "manual"
  readonly orientation?: "horizontal" | "vertical"
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean
  /** How inactive panels are hidden (default `unmount`). */
  readonly inactivePanels?: InactivePanels
  readonly disabled?: boolean
  /** Disabled tabs stay reachable by arrows (never selectable). */
  readonly focusableWhenDisabled?: boolean
  readonly render?: RenderProp<TabsState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  activationMode = "automatic",
  orientation = "horizontal",
  loop = true,
  inactivePanels = "unmount",
  disabled = false,
  focusableWhenDisabled = false,
  render,
  id,
  children,
  ...rest
}: TabsRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const ids = useMemo(() => {
    const t = tabsIds(instance)
    return { list: t.list, item: t.tab }
  }, [instance])
  const { collection: registered, registry } = useCollectionItems()
  const collection = registered ?? EMPTY
  const { view, send } = useMachine(tabsMachine, {
    collection,
    strategy: "roving",
    ids,
    loop,
    focusableWhenDisabled,
    value,
    defaultValue,
    onValueChange,
    activationMode,
    disabled,
  })
  const current = view.values.value ?? null
  const [panels, setPanels] = useState<ReadonlySet<string>>(() => new Set())
  const registerPanel = useCallback((key: string) => {
    setPanels((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    return () =>
      setPanels((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
  }, [])
  const declared = declaredItems(children, Tab)
  const api = tabsConnect(
    {
      instance,
      collection,
      value: current,
      highlightedKey: view.context.highlightedKey,
      pending: registered === null,
      pendingStop: serverStop(declared, current === null ? [] : [current]),
      orientation,
      activationMode,
      inactivePanels,
      disabled,
      focusableWhenDisabled,
      focusWithin: view.matches("focused"),
      // Before the panels' effects (server render): the declared panels that render.
      renderedPanels:
        registered === null
          ? new Set(
              declaredItems(children, Panel)
                .map((p) => p.value)
                .filter((k) => inactivePanels !== "unmount" || k === current),
            )
          : panels,
      panelTabbable: view.context.panelTabbable,
      direction: view.context.direction,
      indicator: view.context.indicator,
      revealed: view.context.revealed,
    },
    send,
    env,
  )
  const ctx: Ctx = {
    api,
    send,
    registry,
    instance,
    value: current,
    disabled,
    inactivePanels,
    orientation,
    collection: registered,
    registerPanel,
  }
  const props = mergeProps(normalizeProps(api.root()), rest)
  return (
    <TabsContext value={ctx}>
      {renderPart("div", { ...props, children }, render, { value: current, orientation })}
    </TabsContext>
  )
}

export type TabsListProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<TabsState>
}

function List({ render, ref, ...rest }: TabsListProps) {
  const ctx = useTabs("List")
  const el = useRef<HTMLElement | null>(null)
  // Development: a tablist needs a name (aria-label or aria-labelledby).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
      console.warn(
        `[rind-ui] tabs: the list #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
      )
    }
  })
  const props = mergeProps({ ...normalizeProps(ctx.api.list()), ref: composeRefs(el, ref) }, rest)
  return renderPart("div", props, render, { value: ctx.value, orientation: ctx.orientation })
}

export interface TabsTabState {
  readonly selected: boolean
  readonly disabled: boolean
}

export type TabsTabProps = Omit<ComponentPropsWithRef<"button">, "value"> & {
  /** The key pairing this tab with its panel. */
  readonly value: string
  readonly disabled?: boolean
  readonly textValue?: string
  readonly render?: RenderProp<TabsTabState>
}

function Tab({ value, disabled = false, textValue, render, ref, ...rest }: TabsTabProps) {
  const ctx = useTabs("Tab")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const key: CollectionKey = toKey(value)
  const el = useRef<HTMLElement | null>(null)
  useRegisterItem(ctx.registry, { key: value, textValue, disabled }, el)
  const tag = useRenderedTag("button", render, el)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const isDisabled = () => ctx.disabled || disabled
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key, modality: e.modality })
    },
    disabled: isDisabled,
  })
  const hover = useHover({ env, send: () => {}, disabled: isDisabled })
  const own = normalizeProps(
    ctx.api.tab(key, {
      tag,
      itemDisabled: disabled,
      focused,
      modality,
      pressed: press.pressed,
      hovered: hover.hovered,
    }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, hover.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, {
    selected: ctx.value === key,
    disabled: isDisabled(),
  })
}

export type TabsPanelProps = Omit<ComponentPropsWithRef<"div">, "value"> & {
  /** The key of the tab this panel belongs to. */
  readonly value: string
  readonly render?: RenderProp<{ readonly selected: boolean }>
}

function Panel({ value, render, ref, children, ...rest }: TabsPanelProps) {
  const ctx = useTabs("Panel")
  const env = useEnvironment()
  const key: CollectionKey = toKey(value)
  const selected = ctx.value === key
  const rendered = ctx.api.panelRendered(key)
  const el = useRef<HTMLElement | null>(null)
  const { registerPanel, send } = ctx
  useIsoLayoutEffect(() => (rendered ? registerPanel(value) : undefined), [rendered, value])
  // A visible panel without tabbable content is itself a tab stop (re-evaluated live).
  useEffect(() => {
    const node = el.current
    if (!node || !selected) return
    return observeTabbable(node, (tabbable) => send({ type: "PANEL.TABBABLE", key, tabbable }))
  }, [selected, key, send])
  // until-found: imperative, re-applied after every commit; beforematch selects the tab.
  const latest = useRef({ selected })
  latest.current = { selected }
  const finder = useRef<ReturnType<typeof untilFound> | null>(null)
  const findable = ctx.inactivePanels === "until-found"
  useIsoLayoutEffect(() => {
    const node = el.current
    if (!findable || !node) return
    const h = untilFound(node, {
      scheduler: env.scheduler,
      isOpen: () => latest.current.selected,
      onReveal: () => send({ type: "find-in-page", key }),
    })
    finder.current = h
    return () => {
      h.dispose()
      finder.current = null
    }
  }, [findable, key, env, send])
  useIsoLayoutEffect(() => {
    finder.current?.sync()
  })
  if (!rendered) return null
  const props = mergeProps(
    { ...normalizeProps(ctx.api.panel(key)), ref: composeRefs(el, ref) },
    {
      ...rest,
      children,
    },
  )
  return renderPart("div", props, render, { selected })
}

export type TabsIndicatorProps = ComponentPropsWithRef<"span"> & {
  readonly render?: RenderProp<{ readonly visible: boolean }>
}

function Indicator({ render, ref, ...rest }: TabsIndicatorProps) {
  const ctx = useTabs("Indicator")
  const el = useRef<HTMLElement | null>(null)
  const { send, instance, collection } = ctx
  const latest = useRef(ctx.value)
  latest.current = ctx.value
  const tabOf = (key: string | null, node: HTMLElement) =>
    key === null ? null : node.ownerDocument.getElementById(tabsIds(instance).tab(toKey(key)))
  const handle = useRef<ReturnType<typeof selectionIndicator> | null>(null)
  useIsoLayoutEffect(() => {
    const node = el.current
    if (!node) return
    const h = selectionIndicator({
      container: () => node.parentElement,
      item: () => tabOf(latest.current, node),
      items: () =>
        [...(node.parentElement?.querySelectorAll<HTMLElement>('[data-part="tab"]') ?? [])].filter(
          (t) => t.getAttribute("data-instance") === instance,
        ),
      onMeasure: (box, cause) => send({ type: "INDICATOR.MEASURE", box, cause }),
    })
    handle.current = h
    // The first measurement never animates (base-ui#998).
    h.measure("layout")
    return () => {
      h.dispose()
      handle.current = null
    }
  }, [instance, send])
  // A selection change moves it (animatable); a registration change re-observes (layout).
  const lastValue = useRef(ctx.value)
  useIsoLayoutEffect(() => {
    if (lastValue.current === ctx.value) return
    lastValue.current = ctx.value
    handle.current?.measure("selection")
  }, [ctx.value])
  const lastCollection = useRef(collection)
  useIsoLayoutEffect(() => {
    if (lastCollection.current === collection) return
    lastCollection.current = collection
    handle.current?.refresh()
  }, [collection])
  const props = mergeProps(
    { ...normalizeProps(ctx.api.indicator()), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart("span", props, render, { visible: props["data-state"] === "visible" })
}

export const Tabs = { Root, List, Tab, Panel, Indicator }
