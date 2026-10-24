import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  domHoverIntent,
  domPositioning,
  getLayerStack,
  type HoverIntent,
  type LayerMeta,
  layoutCapability,
  type MenuActivation,
  type MenuLevelId,
  type MenuParentKind,
  type MenuProps,
  type MenuTree,
  type MenuTreeHost,
  menuConnect,
  menuIds,
  menuLayerId,
  menuMachine,
  menuPositioning,
  type Service,
  toKey,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { createContext } from "../context"
import { useParentLayer } from "../layer-context"
import { useEnvironment } from "../provider"
import { useCollectionItems, useRegisterItem } from "../use-collection-items.svelte"
import { useMachine } from "../use-machine.svelte"
import type { MenuLevelOptions, MenuSelectDetails } from "./types"

/**
 * Runs `fn` and returns the last element it tried to focus while that element was inert (a
 * refused move), or null. Synchronous: the prototype is restored before returning.
 */
function focusCalls(fn: () => void): HTMLElement | null {
  if (typeof HTMLElement === "undefined") {
    fn()
    return null
  }
  const proto = HTMLElement.prototype
  const original = proto.focus
  let blocked: HTMLElement | null = null
  proto.focus = function (this: HTMLElement, options?: FocusOptions) {
    original.call(this, options)
    blocked =
      this.ownerDocument.activeElement === this ? null : this.closest("[inert]") ? this : null
  }
  try {
    fn()
  } finally {
    proto.focus = original
  }
  return blocked
}

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** What an item does on activation (its own state first, then `onSelect`). */
export interface Activation {
  readonly activate?: ((a: MenuActivation) => void) | undefined
  readonly onSelect?: ((details: MenuSelectDetails) => void) | undefined
}

/** A menubar hosting a root level (add-menubar). */
export interface MenuHost {
  readonly parentKind: MenuParentKind
  readonly host?: MenuTreeHost | undefined
  /** The bar's roving tabindex for this trigger. */
  readonly tabIndex?: () => number | undefined
  /** The bar's item key for this trigger. */
  readonly key?: () => CollectionKey | undefined
}
/** Provided by a menubar around its menus (add-menubar). */
export const menuHost = createContext<MenuHost | null>("menu-host")

type View = ReturnType<Service<typeof menuMachine>["view"]>

/** One level of a menu tree: internal (a context menu builds its root level from it). */
export interface MenuLevel {
  readonly service: Service<typeof menuMachine>
  readonly view: () => View
  readonly levelId: MenuLevelId
  readonly level: "root" | "submenu"
  readonly props: () => MenuProps
  readonly tree: MenuTree
  readonly keepMounted: () => boolean
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly activations: Map<CollectionKey, Activation>
  readonly submenus: Map<CollectionKey, () => void>
  readonly hoverIntent: HoverIntent
  /** Mutable shared state (a `$state` object owned by the level). */
  readonly shared: {
    trigger: HTMLElement | null
    contentMounted: boolean
    /** The stack's metadata for this layer, followed while open. */
    meta: LayerMeta | undefined
  }
  /** A submenu's content is named by its trigger item. */
  readonly labelledBy?: string | undefined
  readonly inMenubar: boolean
  /** A context menu: the trigger is a region. */
  readonly region?: boolean | undefined
}
export const menuLevel = createContext<MenuLevel>("menu-level")

export const isOpen = (ctx: MenuLevel) => ctx.view().matches("open")

/** The level's connect. */
export function menuApi(
  ctx: MenuLevel,
  env: ReturnType<typeof useEnvironment>,
  extra: { dir?: "ltr" | "rtl" } = {},
) {
  const view = ctx.view()
  const props = ctx.props()
  return menuConnect(
    {
      instance: ctx.levelId,
      level: ctx.level,
      open: view.matches("open"),
      modal: props.modal !== false,
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      collection: props.collection,
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      typingAhead: () => {
        const t = ctx.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (props.typeaheadTimeout ?? 1000)
      },
      contentMounted: ctx.shared.contentMounted,
      labelledBy: ctx.labelledBy,
      meta: ctx.shared.meta,
      manual: menuPositioning(props).mode === "manual",
      inMenubar: ctx.inMenubar,
      region: ctx.region,
      ...extra,
    },
    ctx.service.send,
    env,
  )
}

/** One level's service, its items, its tree registration and its registries: internal. Call during initialisation. */
export function useMenuLevelService(input: {
  readonly level: "root" | "submenu"
  readonly levelId: MenuLevelId
  readonly parentLevel?: MenuLevelId | undefined
  readonly tree: MenuTree
  readonly shared: { trigger: HTMLElement | null; meta: LayerMeta | undefined }
  readonly options: () => MenuLevelOptions
  readonly controllable?: () => Pick<MenuProps, "open" | "defaultOpen" | "onOpenChange" | "modal">
  /** One per tree: a parent level sees its submenu's transit (the grace area). */
  readonly hoverIntent?: HoverIntent | undefined
  /** A context menu's root level. */
  readonly region?: () => Pick<MenuProps, "onAnchorChange">
}) {
  const env = useEnvironment(announcerCapability, layoutCapability)
  const parent = useParentLayer()
  const items = useCollectionItems()
  const hoverIntent = input.hoverIntent ?? domHoverIntent(env)
  const menuEnv = { ...env, position: domPositioning(env), hoverIntent, menuTree: input.tree }
  const activations = new Map<CollectionKey, Activation>()
  const submenus = new Map<CollectionKey, () => void>()
  const m = menuIds(input.levelId)
  const ids = { list: m.content, item: m.item }
  const props = (): MenuProps => {
    const o = input.options()
    return {
      ...(input.region ? { region: true, onAnchorChange: input.region().onAnchorChange } : {}),
      ...input.controllable?.(),
      collection: items.collection ?? EMPTY,
      strategy: "roving",
      ids,
      loop: o.loop ?? true,
      focusableWhenDisabled: o.focusableWhenDisabled ?? true,
      typeaheadTimeout: o.typeaheadTimeout,
      positioning: o.positioning,
      submenuOpenDelay: o.submenuOpenDelay,
      submenuGraceTimeout: o.submenuGraceTimeout,
      level: input.level,
      levelId: input.levelId,
      parentLevel: input.parentLevel,
      parent: parent(),
      getTrigger: () => input.shared.trigger,
      onActivate: (a) => {
        const entry = activations.get(a.key)
        if (!entry) return true
        entry.activate?.(a)
        let cancelled = false
        const blocked = focusCalls(() =>
          entry.onSelect?.({
            key: a.key,
            kind: a.kind,
            modality: a.modality,
            cancel: () => {
              cancelled = true
            },
          }),
        )
        // A modal menu keeps the page inert until it closes: a focus move `onSelect` made
        // outside (an editor) was refused, so it is made again once the menu is gone.
        if (blocked && !cancelled) {
          env.scheduler.requestAnimationFrame(() => {
            if (blocked.isConnected && !blocked.closest("[inert]")) blocked.focus()
          })
        }
        return !cancelled
      },
      openSubmenu: (key) => {
        const open = submenus.get(key)
        open?.()
        return open !== undefined
      },
    }
  }
  const machine = useMachine(menuMachine, props, menuEnv)
  $effect(() => {
    input.shared.meta = undefined
    if (!machine.view.matches("open")) return
    return untrack(() => {
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => {
        input.shared.meta = stack.get(menuLayerId(input.levelId))?.meta()
      }
      read()
      return stack.subscribe(read)
    })
  })
  return {
    service: machine.service,
    send: machine.send,
    view: () => machine.view,
    props,
    registry: items.registry,
    activations,
    submenus,
    hoverIntent,
  }
}

/** Registers an item and its activation with the level; the item's key. Call during initialisation. */
export function useItem(
  ctx: MenuLevel,
  item: () => { value?: string | undefined; textValue?: string | undefined; disabled: boolean },
  activation: () => Activation,
  el: () => Element | null,
  generated: string,
): () => CollectionKey {
  const key = () => toKey(item().value ?? generated)
  useRegisterItem(
    ctx.registry,
    () => ({ key: key(), textValue: item().textValue, disabled: item().disabled }),
    el,
  )
  $effect(() => {
    const k = key()
    untrack(() =>
      ctx.activations.set(k, {
        activate: (a) => activation().activate?.(a),
        onSelect: (d) => activation().onSelect?.(d),
      }),
    )
    return () => {
      ctx.activations.delete(k)
    }
  })
  return key
}

/** The item's checked state, for its indicator. */
export const menuItemState = createContext<{ readonly checked: () => boolean }>("menu-item")

export const menuRadioGroup = createContext<{
  readonly value: () => string | null
  readonly select: (value: string) => void
  readonly disabled: () => boolean
}>("menu-radio-group")

export const menuGroup = createContext<{
  readonly labelId: string
  readonly setLabelled: (on: boolean) => void
}>("menu-group")

export const menuSubmenu = createContext<{
  readonly parent: MenuLevel
  readonly key: CollectionKey
  readonly shared: { trigger: HTMLElement | null }
  /** The SubmenuTrigger's `disabled`: the expand key never opens a disabled submenu. */
  readonly disabled: { current: boolean }
}>("menu-submenu")
