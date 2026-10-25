/** @jsxImportSource solid-js */
import {
  type ContextMenuMessages,
  claimRegionEvent,
  contextMenuMessages,
  contextMenuRegionProps,
  createMenuTree,
  longPress,
  type MenuAnchorDetails,
  type MenuChangeDetails,
  type MenuPoint,
  type MessageOverrides,
  menuIds,
  menuLevelId,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import {
  type MenuLevel,
  MenuLevelContext,
  type MenuLevelOptions,
  useMenuLevelService,
} from "../menu/menu"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    "context-menu": ContextMenuMessages
  }
}

declare const process: { env: { NODE_ENV?: string } }

/** `onOpenChange`'s details, with where and on what the opening gesture happened. */
export type ContextMenuChangeDetails = MenuChangeDetails & {
  readonly point: MenuPoint | null
  readonly target: Element | null
  readonly nativeEvent: Event | null
}

/** What `actionsRef` exposes. */
export interface ContextMenuActions {
  /** Opens it at `point` (viewport coordinates), for `target` (e.g. a document listener). */
  openAt(point: MenuPoint, target?: Element | null): void
  close(): void
}

interface RegionCtx {
  readonly disabled: Accessor<boolean>
  readonly longPress: Accessor<boolean>
  readonly longPressDelay: Accessor<number>
  readonly messages: Accessor<ContextMenuMessages>
}
const RegionContext = createContext<RegionCtx>()

export type ContextMenuRootProps = MenuLevelOptions & {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id?: string | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ContextMenuChangeDetails) => void) | undefined
  /** A second gesture in the same region moved the open menu. */
  readonly onAnchorChange?: ((details: MenuAnchorDetails) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  /** The browser's own menu shows instead. */
  readonly disabled?: boolean | undefined
  /** Default true: a touch or pen held on the region opens it. */
  readonly longPress?: boolean | undefined
  /** Default 500 ms. */
  readonly longPressDelay?: number | undefined
  readonly keepMounted?: boolean | undefined
  readonly messages?: MessageOverrides<ContextMenuMessages> | undefined
  /** Receives the actions once, when the Root is created. */
  readonly actionsRef?: ((actions: ContextMenuActions) => void) | undefined
  /** The context menu's parts: its trigger region and the `Menu` portal, positioner and content. */
  readonly children?: JSX.Element
}

const detailsOf = (d: MenuChangeDetails): ContextMenuChangeDetails => {
  const e = d.event as { point?: MenuPoint; target?: Element | null; nativeEvent?: Event }
  return {
    ...d,
    point: e.point ?? null,
    target: e.target ?? null,
    nativeEvent: e.nativeEvent ?? null,
  }
}

function Root(props: ContextMenuRootProps) {
  const [own, options] = splitProps(props, [
    "id",
    "open",
    "defaultOpen",
    "onOpenChange",
    "onAnchorChange",
    "modal",
    "disabled",
    "longPress",
    "longPressDelay",
    "keepMounted",
    "messages",
    "actionsRef",
    "children",
  ])
  const levelId = menuLevelId(useRootId(() => own.id)())
  const messages = useMessages("context-menu", contextMenuMessages, () => own.messages)
  const tree = createMenuTree({ parentKind: "context-menu" })
  const [trigger, setTrigger] = createSignal<HTMLElement | null>(null)
  const s = useMenuLevelService({
    level: "root",
    levelId,
    tree,
    trigger,
    options,
    controllable: () => ({
      open: own.open,
      defaultOpen: own.defaultOpen,
      onOpenChange: own.onOpenChange
        ? (o: boolean, d: MenuChangeDetails) => own.onOpenChange?.(o, detailsOf(d))
        : undefined,
      modal: own.modal ?? true,
    }),
    region: { onAnchorChange: (d) => own.onAnchorChange?.(d) },
  })
  own.actionsRef?.({
    openAt: (point, target = null) => s.send({ type: "OPEN_AT", point, target }),
    close: () => s.send({ type: "CLOSE" }),
  })
  const isOpen = () => s.view().matches("open")
  afterMount(() => {
    // Development: a controlled open with no gesture anchors at the region's corner.
    createEffect(() => {
      if (process.env.NODE_ENV === "production" || own.open !== true) return
      if (s.service.getSnapshot().context.regionAnchor === null) {
        console.warn(
          `[rind-ui] context-menu ${levelId}: opened without a point; it is placed at the region's top-left corner (use actionsRef.openAt)`,
        )
      }
    })
    // Development: the menu needs a name of its own (no trigger text names it).
    createEffect(() => {
      if (process.env.NODE_ENV === "production" || !isOpen()) return
      const content = document.getElementById(menuIds(levelId).content)
      if (
        content &&
        !content.getAttribute("aria-label") &&
        !content.getAttribute("aria-labelledby")
      ) {
        console.warn(
          `[rind-ui] context-menu ${levelId}: the menu has no accessible name; pass aria-label to Menu.Content`,
        )
      }
    })
  })
  const [contentMounted, setContentMounted] = createSignal(false)
  const ctx: MenuLevel = {
    service: s.service,
    view: s.view,
    levelId,
    level: "root",
    props: s.props,
    tree,
    keepMounted: () => own.keepMounted === true,
    registry: s.registry,
    activations: s.activations,
    submenus: s.submenus,
    hoverIntent: s.hoverIntent,
    trigger,
    setTrigger,
    contentMounted,
    setContentMounted,
    inMenubar: false,
    region: true,
    meta: s.meta,
  }
  return (
    <MenuLevelContext.Provider value={ctx}>
      <RegionContext.Provider
        value={{
          disabled: () => own.disabled === true,
          longPress: () => own.longPress !== false,
          longPressDelay: () => own.longPressDelay ?? 500,
          messages,
        }}
      >
        {own.children}
      </RegionContext.Provider>
    </MenuLevelContext.Provider>
  )
}

export interface ContextMenuTriggerState {
  readonly open: boolean
}

export type ContextMenuTriggerProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly render?: RenderProp<ContextMenuTriggerState> | undefined
  readonly children?: JSX.Element
}

/** The region: a right click, a long press or the context-menu key on it opens the menu. */
function Trigger(props: ContextMenuTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useContext(MenuLevelContext)
  const region = useContext(RegionContext)
  if (!ctx || !region) throw new Error("ContextMenu.Trigger must be inside ContextMenu.Root")
  const env = useEnvironment()
  // The modality tracker classifies a contextmenu with no press before it (AT, keyboard).
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const open = () => ctx.view().matches("open")
  const send = ctx.service.send
  let start: MenuPoint = { x: 0, y: 0 }
  let target: Element | null = null
  const press = usePress({
    env,
    // Read once, when the press is created (as before).
    longPress: longPress({ threshold: untrack(region.longPressDelay), moveTolerance: 10 }),
    disabled: () => region.disabled() || !region.longPress(),
    send: (e) => {
      // Touch and pen only: a held mouse button is no long press.
      if (e.type !== "LONG_PRESS" || (e.pointerType !== "touch" && e.pointerType !== "pen")) return
      send({ type: "REGION.LONG_PRESS", point: start, target })
    },
  })
  const hintId = `${createUniqueId()}-hint`
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  // The hint only for a region the consumer made focusable.
  const [focusable, setFocusable] = createSignal(false)
  afterMount(() => {
    createEffect(() => {
      const node = el()
      if (node) setFocusable(node.hasAttribute("tabindex"))
    })
  })
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const state = reactive<ContextMenuTriggerState>(() => ({ open: open() }))
  const merged = createMemo(() => {
    const own = normalizeProps(
      contextMenuRegionProps(
        {
          instance: ctx.levelId,
          open: open(),
          disabled: region.disabled(),
          hintId: focusable() && region.longPress() ? hintId : undefined,
          focused: focused(),
          modality: modality(),
        },
        send,
        env,
      ),
    )
    // Only the press module's pointer side (and its trailing-click and callout guards): keys
    // on the region and its rows stay the consumer's.
    const { onPointerDown, onPointerEnter, onPointerLeave, onClick, onContextMenu, onDragStart } =
      press.props as Record<string, (e: never) => void>
    return mergeProps(
      {
        ...joinHandlers(own, {
          onClick,
          onContextMenu,
          onDragStart,
          onPointerEnter,
          onPointerLeave,
          // The region's own focus (a focusable region), not its rows'.
          onFocusIn: (e: FocusEvent) => setFocused(e.target === e.currentTarget),
          onFocusOut: (e: FocusEvent) => {
            if (e.target === e.currentTarget) setFocused(false)
          },
        }),
        onPointerDown: (e: PointerEvent) => {
          // The innermost region takes a long press; an outer one never starts its timer.
          if (e.pointerType === "mouse" || !claimRegionEvent(e)) return
          start = { x: e.clientX, y: e.clientY }
          target = e.target as Element
          onPointerDown?.(e as never)
        },
        ref: (node: Element) => {
          setEl(node as HTMLElement)
          ctx.setTrigger(node as HTMLElement)
        },
      },
      rest,
    )
  })
  const children = () => (
    <>
      {local.children}
      <Show when={focusable() && region.longPress()}>
        <span id={hintId} hidden>
          {region.messages().longPressHint}
        </span>
      </Show>
    </>
  )
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

/** The parts, by name: `context-menu.parts.ts` re-exports them as the `ContextMenu` namespace. */
export { Root, Trigger }
