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
  type ComponentPropsWithRef,
  createContext,
  isValidElement,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { useParentLayer } from "../layer-context"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

interface Ctx {
  readonly service: Service<typeof tooltipMachine>
  readonly root: string
  readonly props: TooltipProps
  readonly type: "description" | "label"
  readonly hoverIntent: HoverIntent
  readonly triggerRef: { current: HTMLElement | null }
  readonly contentMounted: boolean
  readonly setContentMounted: (on: boolean) => void
}

const TooltipContext = createContext<Ctx | null>(null)
function useTooltip(part: string): Ctx {
  const ctx = useContext(TooltipContext)
  if (!ctx) throw new Error(`Tooltip.${part} must be inside Tooltip.Root`)
  return ctx
}

function useApi(ctx: Ctx, dir?: "ltr" | "rtl") {
  const view = useSelector(ctx.service, (v) => v)
  const open = view.values.open
  return {
    open,
    api: tooltipConnect(
      {
        instance: ctx.root,
        open,
        instant: view.context.instant,
        placement: view.context.placement,
        type: ctx.type,
        contentMounted: ctx.contentMounted,
        dir,
        manual: tooltipPositioning(ctx.props).mode === "manual",
      },
      ctx.service.send,
    ),
  }
}

/** What `actionsRef` exposes. */
export interface TooltipActions {
  open(): void
  close(): void
}

export type TooltipRootProps = Omit<TooltipProps, "root" | "parent" | "getTrigger"> & {
  /** Base for the ids of the tooltip's parts. Default: generated. */
  readonly id?: string
  /** `description` (default): the text describes the trigger. `label`: it names it. */
  readonly type?: "description" | "label"
  readonly actionsRef?: Ref<TooltipActions>
  /** The tooltip's parts. */
  readonly children?: ReactNode
}

function Root({ id, type = "description", actionsRef, children, ...rest }: TooltipRootProps) {
  const root = useRootId(id)
  const parent = useParentLayer()
  const env = useEnvironment()
  // Positioning, hover intent and the delay group only for components that use them.
  const tooltipEnv = useMemo(
    () => ({
      ...env,
      position: domPositioning(env),
      hoverIntent: domHoverIntent(env),
      delayGroup: domDelayGroup(env),
    }),
    [env],
  )
  // The trigger by reference: a rind-ui part used as the trigger keeps its own id.
  const triggerRef = useRef<HTMLElement | null>(null)
  const props: TooltipProps = { ...rest, root, parent, getTrigger: () => triggerRef.current }
  const { service, send } = useMachine(tooltipMachine, props, tooltipEnv)
  useImperativeHandle(
    actionsRef,
    () => ({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) }),
    [send],
  )
  const [contentMounted, setContentMounted] = useState(false)
  const ctx: Ctx = {
    service,
    root,
    props,
    type,
    hoverIntent: tooltipEnv.hoverIntent,
    triggerRef,
    contentMounted,
    setContentMounted,
  }
  return <TooltipContext value={ctx}>{children}</TooltipContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

export interface TooltipTriggerState {
  readonly open: boolean
}

/** Development warnings about the trigger and the content, once per mount (design §6). */
function useDevWarnings(ctx: Ctx, trigger: { current: HTMLElement | null }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const el = trigger.current
    // Re-run once the (portalled) content mounted: it is what the content checks read.
    if (!el || !ctx.contentMounted) return
    const name = `tooltip #${el.id}`
    if (el.matches(":disabled")) {
      console.warn(
        `[rind-ui] ${name}: the trigger is disabled, so it cannot be focused or hovered; use focusableWhenDisabled (aria-disabled)`,
      )
    } else if (el.tabIndex < 0) {
      console.warn(`[rind-ui] ${name}: the trigger is not focusable; keyboard users never see it`)
    }
    if (ctx.type === "label" && el.hasAttribute("aria-label")) {
      console.warn(
        `[rind-ui] ${name}: aria-label on a type="label" trigger is ignored by assistive technology (aria-labelledby wins)`,
      )
    }
    const content = el.ownerDocument.getElementById(tooltipIds(ctx.root).content)
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
    if (ctx.type === "description") {
      const text = (content.textContent ?? "").trim()
      if (text !== "" && text === accessibleNameOf(el).trim()) {
        console.warn(
          `[rind-ui] ${name}: the description repeats the trigger's name; use type="label"`,
        )
      }
    }
  }, [ctx.type, ctx.root, ctx.contentMounted, trigger])
}

function Trigger({
  render,
  ref,
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  ...rest
}: Own<"button", TooltipTriggerState>) {
  const ctx = useTooltip("Trigger")
  const { api, open } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  useDevWarnings(ctx, el)
  const hover = useMemo(
    () => ctx.hoverIntent.triggerProps((e) => ctx.service.send(e)),
    [ctx.hoverIntent, ctx.service],
  )
  // Rendered through a component (a Switch, an icon button): it keeps its own identity.
  const foreign = isValidElement(render) && typeof render.type !== "string"
  const own = normalizeProps(
    api.trigger({ focused, hovered, modality, describedBy, labelledBy, foreign }, hover),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onPointerMove: (e: { pointerType: string }) => {
          if (e.pointerType === "mouse" || e.pointerType === "pen") setHovered(true)
        },
        onPointerLeave: () => setHovered(false),
        onPointerDown: (e: { pointerType: string }) =>
          api.pressStart(e.pointerType === "mouse" || e.pointerType === "pen"),
        onKeyDown: (e: { key: string }) => {
          if (e.key === "Enter" || e.key === " ") api.pressStart(false)
        },
        // Assistive technology activates with a bare click (no pointer or key events).
        onClick: (e: { detail: number }) => {
          if (e.detail === 0) api.pressStart(false)
        },
        onFocus: (e: { currentTarget: Element }) => {
          setFocused(true)
          const f = focusEvent(e.currentTarget, env.modality)
          api.focus(f.modality, f.cause)
        },
        onBlur: () => {
          setFocused(false)
          api.blur()
        },
      }),
      ref: composeRefs(composeRefs(el, ctx.triggerRef), ref),
    },
    rest,
  )
  return renderPart("button", props, render, { open })
}

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Ctx, open: boolean) {
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  useIsoLayoutEffect(() => {
    if (!open) return
    const found = ctx.triggerRef.current?.closest("[dir]")?.getAttribute("dir")
    setDir(found === "rtl" ? "rtl" : "ltr")
  }, [open, ctx.triggerRef])
  return dir
}

/** Always mounted (the description exists while closed); hidden once the exit ends. */
function usePart(open: boolean) {
  const node = useRef<HTMLElement | null>(null)
  const { state } = usePresence(open, node, { keepMounted: true, subtree: true })
  // Hidden only once presence is over: the commit that closes is still "present", and
  // hiding there would cut the exit animation.
  return { node, hidden: !open && state === "absent" }
}

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useTooltip("Positioner")
  const open = useSelector(ctx.service, (v) => v.values.open)
  const dir = useTriggerDir(ctx, open)
  const { api } = useApi(ctx, dir)
  const { node, hidden } = usePart(open)
  const props = mergeProps(
    { ...normalizeProps(api.positioner()), hidden, ref: composeRefs(node, ref) },
    { ...rest, children },
  )
  return renderPart("div", props, render, undefined)
}

export interface TooltipContentState {
  readonly open: boolean
}

function Content({ render, ref, ...rest }: Own<"div", TooltipContentState>) {
  const ctx = useTooltip("Content")
  const { api, open } = useApi(ctx)
  const { node, hidden } = usePart(open)
  const { setContentMounted } = ctx
  // Referenced by the trigger only once it exists: a portalled content mounts after
  // hydration, so the server markup never has a dangling IDREF.
  useIsoLayoutEffect(() => {
    setContentMounted(true)
    return () => setContentMounted(false)
  }, [setContentMounted])
  const props = mergeProps(
    { ...normalizeProps(api.content()), hidden, ref: composeRefs(node, ref) },
    rest,
  )
  return renderPart("div", props, render, { open })
}

function Arrow({ render, ...rest }: Own<"div">) {
  const ctx = useTooltip("Arrow")
  const { api } = useApi(ctx)
  return renderPart("div", mergeProps(normalizeProps(api.arrow()), rest), render, undefined)
}

function Portal(props: PortalProps) {
  const ctx = useTooltip("Portal")
  // The host carries the trigger's theme, dir and lang.
  const logicalParent = () => ctx.triggerRef.current
  // Closed tooltips cost nothing: the host follows the trigger's theme only while open.
  const open = useSelector(ctx.service, (v) => v.values.open)
  return <PortalPart logicalParent={logicalParent} observe={open} {...props} />
}

export const Tooltip = { Root, Trigger, Portal, Positioner, Content, Arrow }
