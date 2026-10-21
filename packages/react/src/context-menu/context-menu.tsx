"use client"

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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import {
  type MenuLevel,
  MenuLevelContext,
  type MenuLevelOptions,
  useMenuApi,
  useMenuLevelService,
} from "../menu/menu"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useSelector } from "../use-machine"
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
  readonly disabled: boolean
  readonly longPress: boolean
  readonly longPressDelay: number
  readonly messages: ContextMenuMessages
}
const RegionContext = createContext<RegionCtx | null>(null)

export type ContextMenuRootProps = MenuLevelOptions & {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id?: string
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: ContextMenuChangeDetails) => void
  /** A second gesture in the same region moved the open menu. */
  readonly onAnchorChange?: (details: MenuAnchorDetails) => void
  /** Default true. */
  readonly modal?: boolean
  /** The browser's own menu shows instead. */
  readonly disabled?: boolean
  /** Default true: a touch or pen held on the region opens it. */
  readonly longPress?: boolean
  /** Default 500 ms. */
  readonly longPressDelay?: number
  readonly keepMounted?: boolean
  readonly messages?: MessageOverrides<ContextMenuMessages>
  readonly actionsRef?: Ref<ContextMenuActions>
  /** The context menu's parts: its trigger region and the `Menu` portal, positioner and content. */
  readonly children?: ReactNode
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

function Root({
  id,
  open,
  defaultOpen,
  onOpenChange,
  onAnchorChange,
  modal = true,
  disabled = false,
  longPress = true,
  longPressDelay = 500,
  keepMounted = false,
  messages: ownMessages,
  actionsRef,
  children,
  ...options
}: ContextMenuRootProps) {
  const levelId = menuLevelId(useRootId(id))
  const messages = useMessages("context-menu", contextMenuMessages, ownMessages)
  const [tree] = useState(() => createMenuTree({ parentKind: "context-menu" }))
  const triggerRef = useRef<HTMLElement | null>(null)
  const s = useMenuLevelService({
    level: "root",
    levelId,
    tree,
    triggerRef,
    options,
    controllable: {
      open,
      defaultOpen,
      onOpenChange: onOpenChange ? (o, d) => onOpenChange(o, detailsOf(d)) : undefined,
      modal,
    },
    region: { onAnchorChange },
  })
  useImperativeHandle(
    actionsRef,
    () => ({
      openAt: (point, target = null) => s.send({ type: "OPEN_AT", point, target }),
      close: () => s.send({ type: "CLOSE" }),
    }),
    [s.send],
  )
  const isOpen = useSelector(s.service, (v) => v.matches("open"))
  // Development: a controlled open with no gesture anchors at the region's corner.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || open !== true) return
    if (s.service.getSnapshot().context.regionAnchor === null) {
      console.warn(
        `[rind-ui] context-menu ${levelId}: opened without a point; it is placed at the region's top-left corner (use actionsRef.openAt)`,
      )
    }
  }, [open, levelId, s.service])
  // Development: the menu needs a name of its own (no trigger text names it).
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !isOpen) return
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
  }, [isOpen, levelId])
  const [contentMounted, setContentMounted] = useState(false)
  const ctx: MenuLevel = {
    service: s.service,
    levelId,
    level: "root",
    props: s.props,
    tree,
    keepMounted,
    registry: s.registry,
    activations: s.activations,
    submenus: s.submenus,
    hoverIntent: s.hoverIntent,
    triggerRef,
    contentMounted,
    setContentMounted,
    inMenubar: false,
    region: true,
  }
  return (
    <MenuLevelContext value={ctx}>
      <RegionContext value={{ disabled, longPress, longPressDelay, messages }}>
        {children}
      </RegionContext>
    </MenuLevelContext>
  )
}

export interface ContextMenuTriggerState {
  readonly open: boolean
}

/** The region: a right click, a long press or the context-menu key on it opens the menu. */
function Trigger({
  render,
  ref,
  children,
  ...rest
}: ComponentPropsWithRef<"div"> & { readonly render?: RenderProp<ContextMenuTriggerState> }) {
  const ctx = useContext(MenuLevelContext)
  const region = useContext(RegionContext)
  if (!ctx || !region) throw new Error("ContextMenu.Trigger must be inside ContextMenu.Root")
  const env = useEnvironment()
  // The modality tracker classifies a contextmenu with no press before it (AT, keyboard).
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const { open } = useMenuApi(ctx)
  const send = ctx.service.send
  const start = useRef<MenuPoint>({ x: 0, y: 0 })
  const press = usePress({
    env,
    // Read once, when the press is created (as before).
    longPress: longPress({ threshold: region.longPressDelay, moveTolerance: 10 }),
    disabled: () => region.disabled || !region.longPress,
    send: (e) => {
      // Touch and pen only: a held mouse button is no long press.
      if (e.type !== "LONG_PRESS" || (e.pointerType !== "touch" && e.pointerType !== "pen")) return
      send({ type: "REGION.LONG_PRESS", point: start.current, target: target.current })
    },
  })
  const target = useRef<Element | null>(null)
  const hintId = `${useId()}-hint`
  const el = useRef<HTMLElement | null>(null)
  // The hint only for a region the consumer made focusable.
  const [focusable, setFocusable] = useState(false)
  useEffect(() => {
    setFocusable(el.current?.hasAttribute("tabindex") === true)
  })
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const own = normalizeProps(
    contextMenuRegionProps(
      {
        instance: ctx.levelId,
        open,
        disabled: region.disabled,
        hintId: focusable && region.longPress ? hintId : undefined,
        focused,
        modality,
      },
      send,
      env,
    ),
  )
  // Only the press module's pointer side (and its trailing-click and callout guards): keys on
  // the region and its rows stay the consumer's.
  const { onPointerDown, onPointerEnter, onPointerLeave, onClick, onContextMenu, onDragStart } =
    press.props
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onClick,
        onContextMenu,
        onDragStart,
        onPointerEnter,
        onPointerLeave,
        // The region's own focus (a focusable region), not its rows'.
        onFocus: (e: React.FocusEvent) => setFocused(e.target === e.currentTarget),
        onBlur: (e: React.FocusEvent) => {
          if (e.target === e.currentTarget) setFocused(false)
        },
      }),
      onPointerDown: (e: React.PointerEvent) => {
        // The innermost region takes a long press; an outer one never starts its timer.
        if (e.pointerType === "mouse" || !claimRegionEvent(e)) return
        start.current = { x: e.clientX, y: e.clientY }
        target.current = e.target as Element
        onPointerDown(e)
      },
      ref: composeRefs(el, composeRefs(ctx.triggerRef, ref)),
    },
    {
      ...rest,
      children: (
        <>
          {children}
          {focusable && region.longPress ? (
            <span id={hintId} hidden>
              {region.messages.longPressHint}
            </span>
          ) : null}
        </>
      ),
    },
  )
  return renderPart("div", props, render, { open })
}

/** The parts, by name: `context-menu.parts.ts` re-exports them as the `ContextMenu` namespace. */
export { Root, Trigger }
