import {
  contentSize,
  domHoverIntent,
  domPositioning,
  type HoverIntent,
  type MessageOverrides,
  type NavigationMenuLevel,
  type NavigationMenuMessages,
  type NavigationMenuProps,
  navigationMenuConnect,
  navigationMenuLevel,
  navigationMenuMachine,
  navigationMenuMessages,
  navigationMenuPositioning,
  type PositioningProps,
  type Service,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { createContext } from "../context"
import { useParentLayer } from "../layer-context"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"

type Api = ReturnType<typeof navigationMenuConnect>

export interface Positioned {
  readonly anchor: "trigger" | "list"
  readonly positioning?: PositioningProps | undefined
  /** One Positioner per item (around its Content), not one around the Viewport. */
  readonly perItem: boolean
}

interface Delays {
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
}

export interface LevelCtx {
  readonly service: Service<typeof navigationMenuMachine>
  readonly root: () => string
  readonly api: () => Api
  readonly value: () => string | null
  readonly level: NavigationMenuLevel
  readonly orientation: () => "horizontal" | "vertical"
  readonly closedContent: () => "hidden" | "unmount"
  readonly disabled: () => boolean
  readonly hoverIntent: HoverIntent
  readonly items: Map<string, HTMLElement>
  readonly disabledItems: Map<string, boolean>
  /** Mutable shared state (a `$state` object owned by the level). */
  readonly shared: {
    viewport: HTMLElement | null
    itemsVersion: number
    current: ReadonlySet<string>
  }
  /** Registers a Positioner: `slot` is its item's key, or `""` around the Viewport. */
  readonly registerPositioner: (slot: string, p: Positioned) => () => void
  readonly markCurrent: (key: string, on: boolean) => void
  /** The delays a Sub level inherits. */
  readonly delays: () => Delays
}
export const navLevel = createContext<LevelCtx>("navigation-menu")

export interface ItemCtx {
  /** The level the item belongs to (a Sub's Positioner is not its parent item's). */
  readonly root: string
  readonly key: string
  readonly shared: { contentMounted: boolean }
}
export const navItem = createContext<ItemCtx>("navigation-menu-item")

/** A panel, and the panel it is nested in (a current link marks every ancestor trigger). */
export interface PanelCtx {
  readonly item: string
  readonly level: LevelCtx
  readonly parent: PanelCtx | null
}
/** Inside a panel: links and nested triggers move with ArrowDown / ArrowUp. */
export const navPanel = createContext<PanelCtx>("navigation-menu-panel")

export interface LevelInput {
  readonly value: string | null | undefined
  readonly defaultValue: string | null | undefined
  readonly onValueChange: NavigationMenuProps["onValueChange"]
  readonly orientation: "horizontal" | "vertical" | undefined
  readonly id: string | undefined
  readonly uid: string
  readonly openOnHover?: boolean | undefined
  readonly disabled: boolean | undefined
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
  readonly closedContent: "hidden" | "unmount"
  readonly messages?: MessageOverrides<NavigationMenuMessages> | undefined
  readonly defaultOrientation: "horizontal" | "vertical"
}

/** One level's service and registries. Call during initialisation. */
export function useLevelState(own: () => LevelInput, parent: LevelCtx | null): LevelCtx {
  const root = () => own().id ?? own().uid
  const env = useEnvironment()
  const navEnv = { ...env, position: domPositioning(env), hoverIntent: domHoverIntent(env) }
  const locale = useLocale(() => undefined)
  const messages = useMessages("navigation-menu", navigationMenuMessages, () => own().messages)
  const items = new Map<string, HTMLElement>()
  const disabledItems = new Map<string, boolean>()
  const shared = $state({
    viewport: null as HTMLElement | null,
    itemsVersion: 0,
    current: new Set<string>() as ReadonlySet<string>,
  })
  // Keyed per Positioner, so one item's Positioner unmounting leaves the others registered.
  let positioners = $state.raw<ReadonlyMap<string, Positioned>>(new Map())
  const registerPositioner = (slot: string, p: Positioned) => {
    positioners = new Map(positioners).set(slot, p)
    return () => {
      if (positioners.get(slot) !== p) return
      const next = new Map(positioners)
      next.delete(slot)
      positioners = next
    }
  }
  const markCurrent = (key: string, on: boolean) => {
    if (shared.current.has(key) === on) return
    const next = new Set(shared.current)
    if (on) next.add(key)
    else next.delete(key)
    shared.current = next
  }
  let service: Service<typeof navigationMenuMachine> | null = null
  const level = navigationMenuLevel(parent?.level ?? null, {
    close: () => service?.send({ type: "LINK.ACTIVATE" }),
    parentClose: () => service?.send({ type: "PARENT.CLOSE" }),
    openOnHover: () => own().openOnHover !== false,
  })
  if (parent) $effect(() => untrack(() => parent.level.add(level)))
  const parentLayer = useParentLayer()
  const orientation = () => own().orientation ?? own().defaultOrientation
  // The open item's own Positioner, else the Viewport's, else any item's (a closed menu).
  // ponytail: read from the last value, so per-item `positioning` that differs between items
  // lags one switch; pass a per-key getter to the machine if that matters.
  let lastValue: string | null = null
  const positioner = (): Positioned | undefined =>
    positioners.get(lastValue ?? "") ?? positioners.get("") ?? positioners.values().next().value
  const machine = useMachine(
    navigationMenuMachine,
    () => {
      const o = own()
      const p = positioner()
      return {
        value: o.value,
        defaultValue: o.defaultValue,
        onValueChange: o.onValueChange,
        openOnHover: level.openOnHover(),
        disabled: o.disabled,
        openDelay: o.openDelay,
        closeDelay: o.closeDelay,
        skipDelay: o.skipDelay,
        patientClick: o.patientClick,
        orientation: orientation(),
        root: root(),
        parent: parentLayer(),
        level,
        isItemDisabled: (key: string) => disabledItems.get(key) === true,
        positioned:
          p === undefined ? undefined : p.perItem ? ("item" as const) : ("level" as const),
        anchor: p?.anchor,
        positioning: p?.positioning,
      }
    },
    navEnv,
  )
  service = machine.service
  const value = () => (machine.view.values.value as string | null | undefined) ?? null
  const api = $derived.by(() => {
    const v = value()
    lastValue = v
    void shared.itemsVersion
    // Item order for the motion direction: document order of the registered items.
    const order = [...items.entries()]
      .sort(([, a], [, b]) => (a.compareDocumentPosition(b) & 4 ? -1 : 1))
      .map(([k]) => k)
    const view = machine.view
    return navigationMenuConnect(
      {
        instance: root(),
        value: v,
        previous: view.context.previous,
        order,
        orientation: orientation(),
        dir: locale.current.dir,
        instant: view.context.instant,
        placement: view.context.placement,
        indicator: view.context.indicator,
        manual:
          navigationMenuPositioning({ positioning: positioner()?.positioning }).mode === "manual",
        messages: messages(),
      },
      machine.service.send,
    )
  })
  return {
    service: machine.service,
    root,
    api: () => api,
    value,
    level,
    orientation,
    closedContent: () => own().closedContent,
    disabled: () => own().disabled === true,
    hoverIntent: navEnv.hoverIntent,
    items,
    disabledItems,
    shared,
    registerPositioner,
    markCurrent,
    delays: () => ({
      openDelay: own().openDelay,
      closeDelay: own().closeDelay,
      skipDelay: own().skipDelay,
      patientClick: own().patientClick,
    }),
  }
}

/** Content size properties, after the update that changed `open` (collapsible's sequence). */
export function useSizeSequence(
  el: () => Element | null,
  value: () => string | null,
  part: "content" | "viewport",
  enabled: () => boolean,
) {
  let size: { node: HTMLElement; s: ReturnType<typeof contentSize> } | null = null
  let last: string | null | undefined
  $effect(() => {
    const node = el()
    const v = value()
    const on = enabled()
    return untrack(() => {
      const prev = last
      if (prev === v) return
      last = v
      if (!(node instanceof HTMLElement) || !on) return
      if (size?.node !== node) size = { node, s: contentSize(node, "rind-navigation-menu", part) }
      const s = size.s
      if (v === null) {
        if (prev !== undefined && prev !== null) s.closed()
        return
      }
      if (prev === undefined) return s.opened({ instant: true })
      if (prev === null) s.opened({ instant: false })
      else s.switched()
      // Settled once the enter animations finished (or at once when nothing animates).
      const running = node.getAnimations?.({ subtree: true }) ?? []
      let live = true
      void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (live) s.settled()
      })
      return () => {
        live = false
      }
    })
  })
}
