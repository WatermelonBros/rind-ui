// Toast: `Toaster` (the region of one store, rendered while it shows toasts) and the toast
// parts. Wiring only: the store and machines own lifetime, pausing and announcements; the
// connect owns every attribute; core/dom owns the hotkey, focus moves, measurement and the
// swipe.

import {
  measureToast,
  type SwipeDirection,
  type Toaster as ToasterStore,
  type ToastMessages,
  type ToastSnapshot,
  toasterConnect,
  toasterMachine,
  toastMessages,
  trackSwipe,
  trackToastRegion,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal } from "../portal"
import { useEnvironment, useLocale } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

interface RegionCtx {
  readonly store: ToasterStore
  readonly instance: string
  readonly api: ReturnType<typeof toasterConnect>
  readonly swipeDirections: readonly SwipeDirection[]
  readonly setSwiping: (active: boolean) => void
  readonly leaving: (el: HTMLElement) => void
}
const RegionContext = createContext<RegionCtx | null>(null)

interface ToastCtx {
  readonly region: RegionCtx
  readonly toast: ToastSnapshot
  readonly rendered: { readonly title: boolean; readonly description: boolean }
  readonly mount: (part: "title" | "description", on: boolean) => void
}
const ToastContext = createContext<ToastCtx | null>(null)
function useToast(part: string): ToastCtx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error(`Toast.${part} must be inside Toast.Root`)
  return ctx
}

/** The default swipe: the placement's edge and the inline end. */
function defaultDirections(placement: string, dir: "ltr" | "rtl"): SwipeDirection[] {
  const edge: SwipeDirection = placement.startsWith("top") ? "up" : "down"
  return [edge, dir === "rtl" ? "left" : "right"]
}

export interface ToasterProps {
  readonly toaster: ToasterStore
  readonly id?: string
  /** One toast's markup (newest first). */
  readonly children: (toast: ToastSnapshot) => ReactNode
  readonly messages?: Partial<ToastMessages>
  /** Default true: rendered in the shared portal. */
  readonly portal?: boolean
}

/** The region of one store: rendered only while it shows toasts (zag#2988). */
export function Toaster({ toaster, id, children, messages: own, portal = true }: ToasterProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale, dir } = useLocale()
  const messages: ToastMessages = { ...toastMessages, ...own }
  // Read when the store starts a toast: the latest, without re-attaching.
  const latestMessages = useRef(messages)
  latestMessages.current = messages
  const toasts = useSyncExternalStore(toaster.subscribe, toaster.toasts, toaster.toasts)
  const { view, send } = useMachine(toasterMachine, {
    expand: toaster.options.expand,
    onReason: (reason, on) => toaster.regionReason(reason, on),
  })
  // Bound to this environment while mounted; the announcer's regions created eagerly.
  // The region renders after mount only: the server and the first client render show no
  // toast (no hydration mismatch, no region before the store is bound).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const stopPrepare = env.announcer.prepare()
    const detach = toaster.attach(env, { messages: latestMessages.current })
    return () => {
      detach()
      stopPrepare()
    }
  }, [toaster, env])
  const regionEl = useRef<HTMLElement | null>(null)
  const tracker = useRef<ReturnType<typeof trackToastRegion> | null>(null)
  const visible = toasts.length > 0
  useEffect(() => {
    if (!visible) return
    const t = trackToastRegion(env, {
      region: () => regionEl.current,
      toasts: () =>
        Array.from(
          regionEl.current?.querySelectorAll<HTMLElement>(
            '[data-scope="toast"][data-part="root"]',
          ) ?? [],
        ),
      hotkey: toaster.options.hotkey,
      onEnter: () => send({ type: "HOTKEY" }),
    })
    tracker.current = t
    return () => {
      t.stop()
      tracker.current = null
    }
  }, [visible, env, toaster, send])
  // Stable across renders: the toasts' swipe effects depend on them (a re-run mid-drag
  // would stop the gesture).
  const directions =
    toaster.options.swipeDirections ?? defaultDirections(toaster.options.placement, dir ?? "ltr")
  const directionsKey = directions.join(",")
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the directions' value
  const swipeDirections = useMemo(() => directions, [directionsKey])
  const [setSwiping] = useState(() => (active: boolean) => send({ type: "SWIPING", active }))
  const [leaving] = useState(() => (el: HTMLElement) => tracker.current?.leaving(el))
  const api = toasterConnect({
    instance,
    placement: toaster.options.placement,
    toasts,
    expanded: view.matches("expanded") || toaster.options.expand,
    paused: view.context.hovered || view.context.focused,
    gap: toaster.options.gap,
    hotkey: toaster.options.hotkey,
    messages,
  })
  if (!api.visible || !mounted) return null
  const ctx: RegionCtx = {
    store: toaster,
    instance,
    api,
    swipeDirections,
    setSwiping,
    leaving,
  }
  const modalityOf = () => env.modality.modality()
  const region = (
    <section
      {...joinHandlers(normalizeProps(api.region()), {
        // Mouse and pen hover pause and expand; a touch never hovers.
        onPointerEnter: (e: React.PointerEvent) => {
          if (e.pointerType !== "touch") send({ type: "HOVER.START", modality: "pointer" })
        },
        onPointerLeave: (e: React.PointerEvent) => {
          if (e.pointerType !== "touch") send({ type: "HOVER.END", modality: "pointer" })
        },
        onFocus: (e: React.FocusEvent) => {
          const region = e.currentTarget
          if (!region.contains(e.relatedTarget as Node | null)) {
            send({ type: "FOCUS.ENTER", modality: modalityOf() })
          }
        },
        onBlur: (e: React.FocusEvent) => {
          const region = e.currentTarget
          if (!region.contains(e.relatedTarget as Node | null)) {
            send({ type: "FOCUS.LEAVE", modality: modalityOf() })
          }
        },
      })}
      ref={regionEl}
      dir={dir}
      lang={locale}
    >
      <ol {...normalizeProps(api.list())}>
        <RegionContext value={ctx}>
          {toasts.map((t) => (
            <ToastSlot key={t.instance} toast={t}>
              {children(t)}
            </ToastSlot>
          ))}
        </RegionContext>
      </ol>
    </section>
  )
  return portal ? <Portal>{region}</Portal> : region
}

/** Provides one toast to its parts. */
function ToastSlot({ toast, children }: { toast: ToastSnapshot; children: ReactNode }) {
  const region = useContext(RegionContext)
  const [rendered, setRendered] = useState({ title: false, description: false })
  const [mount] = useState(
    () => (part: "title" | "description", on: boolean) =>
      setRendered((r) => (r[part] === on ? r : { ...r, [part]: on })),
  )
  if (!region) return null
  const ctx: ToastCtx = { region, toast, rendered, mount }
  return <ToastContext value={ctx}>{children}</ToastContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<ToastSnapshot>
}

function Root({ render, ref, ...rest }: Own<"li">) {
  const ctx = useToast("Root")
  const env = useEnvironment()
  const { store } = ctx.region
  const { toast } = ctx
  const service = store.service(toast.instance)
  const node = useRef<HTMLElement | null>(null)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const open = toast.state !== "dismissed"
  const { mounted } = usePresence(open, node, {
    // The exit ended: the record goes (presses during the exit keep nothing: mui/base-ui#5135).
    onExitComplete: () => store.remove(toast.instance),
  })
  // Before it becomes inert for its exit, focus inside moves on (mui/base-ui#3466).
  const { leaving } = ctx.region
  useIsoLayoutEffect(() => {
    if (!open && node.current) leaving(node.current)
  }, [open, leaving])
  // Its layout height, unscaled, on mount and on every resize.
  useEffect(() => {
    const el = node.current
    if (!el || !service) return
    return measureToast(el, (height) => service.send({ type: "MEASURED", height }))
  }, [service])
  // The swipe: discrete events only; it pauses the toast while in progress.
  const { swipeDirections, setSwiping } = ctx.region
  const dismissible = toast.data.dismissible !== false
  useEffect(() => {
    if (!service || !dismissible || !open) return
    const tracker = trackSwipe(env, {
      element: () => node.current,
      directions: () => swipeDirections,
      prefix: "toast",
      onStart: (e) => {
        service.send({ type: "PAUSE", reason: "swipe" })
        service.send({ type: "SWIPE.START", modality: e.modality })
        setSwiping(true)
      },
      onEnd: (e) => {
        service.send({ type: "SWIPE", ...e })
        service.send({ type: "RESUME", reason: "swipe" })
        setSwiping(false)
        if (service.getSnapshot().state !== "dismissed") tracker.reset()
      },
      onCancel: () => {
        service.send({ type: "SWIPE.CANCEL" })
        service.send({ type: "RESUME", reason: "swipe" })
        setSwiping(false)
      },
    })
    return () => tracker.stop()
  }, [service, dismissible, open, env, swipeDirections, setSwiping])
  // Development: a persistent toast without a close trigger strands touch screen readers.
  useEffect(() => {
    const el = node.current
    if (process.env.NODE_ENV === "production" || !el || toast.state !== "persistent") return
    if (!el.querySelector('[data-part="close-trigger"]')) {
      console.warn(
        `[rind-ui] toast "${toast.data.id}": a persistent toast without Toast.CloseTrigger; touch screen-reader users cannot press Escape or swipe`,
      )
    }
  }, [toast.state, toast.data.id])
  if (!mounted || !service) return null
  const own = normalizeProps(
    ctx.region.api.root(toast, { rendered: ctx.rendered, focused, modality }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onKeyDown: ctx.region.api.onRootKeyDown(service.send),
        // The toast itself, not its buttons: data-focus(-visible) on the root.
        onFocus: (e: React.FocusEvent) => setFocused(e.target === e.currentTarget),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(node, ref),
    },
    rest,
  )
  return renderPart("li", props, render, toast)
}

function useMounted(part: "title" | "description") {
  const { mount } = useToast(part === "title" ? "Title" : "Description")
  useIsoLayoutEffect(() => {
    mount(part, true)
    return () => mount(part, false)
  }, [part, mount])
}

function Title({ render, children, ...rest }: Own<"div">) {
  const ctx = useToast("Title")
  useMounted("title")
  const props = mergeProps(normalizeProps(ctx.region.api.title(ctx.toast)), {
    ...rest,
    children: children ?? ctx.toast.data.title,
  })
  return renderPart("div", props, render, ctx.toast)
}

function Description({ render, children, ...rest }: Own<"div">) {
  const ctx = useToast("Description")
  useMounted("description")
  const props = mergeProps(normalizeProps(ctx.region.api.description(ctx.toast)), {
    ...rest,
    children: children ?? ctx.toast.data.description,
  })
  return renderPart("div", props, render, ctx.toast)
}

function useButton(send: () => void) {
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") send()
    },
  })
  return {
    state: { focused, modality, pressed: press.pressed },
    handlers: joinHandlers(press.props, {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    }),
  }
}

function ActionTrigger({ render, children, ...rest }: Own<"button">) {
  const ctx = useToast("ActionTrigger")
  const service = ctx.region.store.service(ctx.toast.instance)
  const b = useButton(() => service?.send({ type: "ACTION_PRESS", modality: "pointer" }))
  const own = normalizeProps(ctx.region.api.actionTrigger(ctx.toast, b.state))
  const props = mergeProps(
    { ...joinHandlers(own, b.handlers) },
    { ...rest, children: children ?? ctx.toast.data.action?.label },
  )
  return renderPart("button", props, render, ctx.toast)
}

function CloseTrigger({ render, ref, children, ...rest }: Own<"button">) {
  const ctx = useToast("CloseTrigger")
  const service = ctx.region.store.service(ctx.toast.instance)
  const b = useButton(() => service?.send({ type: "CLOSE_TRIGGER_PRESS", modality: "pointer" }))
  const el = useRef<HTMLElement | null>(null)
  const [empty, setEmpty] = useState(false)
  useIsoLayoutEffect(() => {
    setEmpty((el.current?.textContent ?? "").trim() === "")
  })
  const own = normalizeProps(ctx.region.api.closeTrigger(ctx.toast, { ...b.state, empty }))
  const props = mergeProps(
    { ...joinHandlers(own, b.handlers), ref: composeRefs(el, ref) },
    { ...rest, children },
  )
  return renderPart("button", props, render, ctx.toast)
}

export const Toast = { Root, Title, Description, ActionTrigger, CloseTrigger }
