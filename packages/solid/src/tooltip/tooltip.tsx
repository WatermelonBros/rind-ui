/** @jsxImportSource solid-js */
import {
  accessibleNameOf,
  domDelayGroup,
  domHoverIntent,
  domPositioning,
  focusEvent,
  type HoverIntent,
  type Service,
  type TooltipProps,
  tooltipConnect,
  tooltipIds,
  tooltipMachine,
  tooltipPositioning,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { keepStyle } from "../keep-style"
import { useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare const process: { env: { NODE_ENV?: string } }

type View = ReturnType<Service<typeof tooltipMachine>["view"]>

interface Ctx {
  readonly service: Service<typeof tooltipMachine>
  readonly view: Accessor<View>
  readonly root: Accessor<string>
  readonly props: Accessor<TooltipProps>
  readonly type: Accessor<"description" | "label">
  readonly hoverIntent: HoverIntent
  readonly trigger: Accessor<HTMLElement | null>
  readonly setTrigger: (el: HTMLElement | null) => void
  readonly contentMounted: Accessor<boolean>
  readonly setContentMounted: (on: boolean) => void
}

const TooltipContext = createContext<Ctx>()
function useTooltip(part: string): Ctx {
  const ctx = useContext(TooltipContext)
  if (!ctx) throw new Error(`Tooltip.${part} must be inside Tooltip.Root`)
  return ctx
}

const isOpen = (ctx: Ctx) => ctx.view().values.open

function useApi(ctx: Ctx, dir: Accessor<"ltr" | "rtl" | undefined> = () => undefined) {
  return createMemo(() => {
    const view = ctx.view()
    return tooltipConnect(
      {
        instance: ctx.root(),
        open: view.values.open,
        instant: view.context.instant,
        placement: view.context.placement,
        type: ctx.type(),
        contentMounted: ctx.contentMounted(),
        dir: dir(),
        manual: tooltipPositioning(ctx.props()).mode === "manual",
      } as Parameters<typeof tooltipConnect>[0],
      ctx.service.send,
    )
  })
}

/** What `actionsRef` exposes. */
export interface TooltipActions {
  open(): void
  close(): void
}

export type TooltipRootProps = Omit<TooltipProps, "root" | "parent" | "getTrigger"> & {
  /** Base for the ids of the tooltip's parts. Default: generated. */
  readonly id?: string | undefined
  /** `description` (default): the text describes the trigger. `label`: it names it. */
  readonly type?: "description" | "label" | undefined
  /** Receives the actions once, when the Root is created. */
  readonly actionsRef?: ((actions: TooltipActions) => void) | undefined
  /** The tooltip's parts. */
  readonly children?: JSX.Element
}

function Root(props: TooltipRootProps) {
  const [own, rest] = splitProps(props, ["id", "type", "actionsRef", "children"])
  const root = useRootId(() => own.id)
  const parent = useParentLayer()
  const env = useEnvironment()
  // Positioning, hover intent and the delay group only for components that use them.
  const tooltipEnv = {
    ...env,
    position: domPositioning(env),
    hoverIntent: domHoverIntent(env),
    delayGroup: domDelayGroup(env),
  }
  // The trigger by reference: a rind-ui part used as the trigger keeps its own id.
  let triggerEl: HTMLElement | null = null
  const [trigger, setTriggerSignal] = createSignal<HTMLElement | null>(null)
  const machineProps = (): TooltipProps =>
    ({
      ...rest,
      root: root(),
      parent: parent(),
      getTrigger: () => triggerEl,
    }) as TooltipProps
  const { view, send, service } = useMachine(tooltipMachine, machineProps, tooltipEnv)
  own.actionsRef?.({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) })
  const [contentMounted, setContentMounted] = createSignal(false)
  const ctx: Ctx = {
    service,
    view,
    root,
    props: machineProps,
    type: () => own.type ?? "description",
    hoverIntent: tooltipEnv.hoverIntent,
    trigger,
    setTrigger: (el) => {
      triggerEl = el
      setTriggerSignal(el)
    },
    contentMounted,
    setContentMounted,
  }
  return <TooltipContext.Provider value={ctx}>{own.children}</TooltipContext.Provider>
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

export interface TooltipTriggerState {
  readonly open: boolean
}

export type TooltipTriggerProps = Own<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  TooltipTriggerState
>

/** Development warnings about the trigger and the content, once per mount (design §6). */
function useDevWarnings(ctx: Ctx) {
  afterMount(() => {
    if (process.env.NODE_ENV === "production") return
    createEffect(() => {
      const el = ctx.trigger()
      // Re-run once the (portalled) content mounted: it is what the content checks read.
      if (!el || !ctx.contentMounted()) return
      const type = ctx.type()
      const name = `tooltip #${el.id}`
      if (el.matches(":disabled")) {
        console.warn(
          `[rind-ui] ${name}: the trigger is disabled, so it cannot be focused or hovered; use focusableWhenDisabled (aria-disabled)`,
        )
      } else if (el.tabIndex < 0) {
        console.warn(`[rind-ui] ${name}: the trigger is not focusable; keyboard users never see it`)
      }
      if (type === "label" && el.hasAttribute("aria-label")) {
        console.warn(
          `[rind-ui] ${name}: aria-label on a type="label" trigger is ignored by assistive technology (aria-labelledby wins)`,
        )
      }
      const content = el.ownerDocument.getElementById(tooltipIds(untrack(ctx.root)).content)
      if (!content) return
      // Hidden closed content still holds what it will show: any tabbable descendant.
      const tabbable = content.querySelector<HTMLElement>(
        "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
      )
      if (tabbable) {
        console.warn(
          `[rind-ui] ${name}: its content contains a tabbable element (${tabbable.tagName.toLowerCase()}); tooltips are never focused — use a Hover Card or a Popover`,
        )
      }
      if (type === "description") {
        const text = (content.textContent ?? "").trim()
        if (text !== "" && text === accessibleNameOf(el).trim()) {
          console.warn(
            `[rind-ui] ${name}: the description repeats the trigger's name; use type="label"`,
          )
        }
      }
    })
  })
}

function Trigger(props: TooltipTriggerProps) {
  const [local, rest] = splitProps(props, [
    "render",
    "children",
    "aria-describedby",
    "aria-labelledby",
  ])
  const ctx = useTooltip("Trigger")
  const api = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const [hovered, setHovered] = createSignal(false)
  const modality = useModality(env.modality, focused)
  useDevWarnings(ctx)
  const hover = ctx.hoverIntent.triggerProps((e) => ctx.service.send(e))
  const state = reactive<TooltipTriggerState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() => {
    // Rendered through a component (a Switch, an icon button) it would keep its own identity;
    // a render function cannot tell, so the default holds.
    const own = normalizeProps(
      api().trigger(
        {
          focused: focused(),
          hovered: hovered(),
          modality: modality(),
          describedBy: local["aria-describedby"],
          labelledBy: local["aria-labelledby"],
          foreign: false,
        },
        hover,
      ),
    )
    return mergeProps(
      {
        ...joinHandlers(own, {
          onPointerMove: (e: PointerEvent) => {
            if (e.pointerType === "mouse" || e.pointerType === "pen") setHovered(true)
          },
          onPointerLeave: () => setHovered(false),
          onPointerDown: (e: PointerEvent) =>
            untrack(api).pressStart(e.pointerType === "mouse" || e.pointerType === "pen"),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") untrack(api).pressStart(false)
          },
          // Assistive technology activates with a bare click (no pointer or key events).
          onClick: (e: MouseEvent) => {
            if (e.detail === 0) untrack(api).pressStart(false)
          },
          onFocusIn: (e: FocusEvent) => {
            setFocused(true)
            const f = focusEvent(e.currentTarget as Element, env.modality)
            untrack(api).focus(f.modality, f.cause)
          },
          onFocusOut: () => {
            setFocused(false)
            untrack(api).blur()
          },
        }),
        ref: (el: Element) => ctx.setTrigger(el as HTMLElement),
      },
      rest,
    )
  })
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Ctx) {
  const [dir, setDir] = createSignal<"ltr" | "rtl" | undefined>(undefined)
  afterMount(() => {
    createEffect(() => {
      if (!isOpen(ctx)) return
      const found = ctx.trigger()?.closest("[dir]")?.getAttribute("dir")
      setDir(found === "rtl" ? "rtl" : "ltr")
    })
  })
  return dir
}

/** Always mounted (the description exists while closed); hidden once the exit ends. */
function usePart(ctx: Ctx) {
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), node, {
    keepMounted: () => true,
    subtree: () => true,
  })
  // Hidden only once presence is over: the commit that closes is still "present", and
  // hiding there would cut the exit animation.
  return { setNode, hidden: () => !isOpen(ctx) && presence.state() === "absent" }
}

export type TooltipDivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

function Positioner(props: TooltipDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTooltip("Positioner")
  const dir = useTriggerDir(ctx)
  const api = useApi(ctx, dir)
  const part = usePart(ctx)
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().positioner()), hidden: part.hidden(), ref: part.setNode },
      rest,
    ),
  )
  // Positioning writes this element's style too.
  const kept = keepStyle(merged)
  const children = () => local.children
  return renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>)
}

export interface TooltipContentState {
  readonly open: boolean
}

export type TooltipContentProps = Own<JSX.HTMLAttributes<HTMLDivElement>, TooltipContentState>

function Content(props: TooltipContentProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTooltip("Content")
  const api = useApi(ctx)
  const part = usePart(ctx)
  // Referenced by the trigger only once it exists: a portalled content mounts after
  // hydration, so the server markup never has a dangling IDREF.
  afterMount(() => {
    ctx.setContentMounted(true)
    onCleanup(() => ctx.setContentMounted(false))
  })
  const state = reactive<TooltipContentState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().content()), hidden: part.hidden(), ref: part.setNode },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => <div {...p}>{children()}</div>)
}

function Arrow(props: TooltipDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTooltip("Arrow")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().arrow()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Portal(props: PortalProps) {
  const ctx = useTooltip("Portal")
  // The host carries the trigger's theme, dir and lang.
  const logicalParent = () => ctx.trigger()
  // Closed tooltips cost nothing: the host follows the trigger's theme only while open.
  return <PortalPart logicalParent={logicalParent} observe={isOpen(ctx)} {...props} />
}

/** The parts, by name: `tooltip.parts.ts` re-exports them as the `Tooltip` namespace. */
export { Arrow, Content, Portal, Positioner, Root, Trigger }
