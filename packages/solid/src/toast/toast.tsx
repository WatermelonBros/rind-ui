/** @jsxImportSource solid-js */
// Toast: `Toaster` (the region of one store, rendered while it shows toasts) and the toast
// parts. Wiring only: the store and machines own lifetime, pausing and announcements; the
// connect owns every attribute; core/dom owns the hotkey, focus moves, measurement and the
// swipe.
import {
  announcerCapability,
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
  visibilityCapability,
} from "@rind-ui/core"
import {
  type Accessor,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal } from "../portal"
import { useEnvironment, useLocale } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

interface RegionCtx {
  readonly store: ToasterStore
  readonly api: Accessor<ReturnType<typeof toasterConnect>>
  readonly swipeDirections: Accessor<readonly SwipeDirection[]>
  readonly setSwiping: (active: boolean) => void
  readonly leaving: (el: HTMLElement) => void
}
const RegionContext = createContext<RegionCtx>()

interface ToastCtx {
  readonly region: RegionCtx
  readonly toast: ToastSnapshot
  readonly snapshot: Accessor<ToastSnapshot>
  readonly rendered: Accessor<{ readonly title: boolean; readonly description: boolean }>
  readonly mount: (part: "title" | "description", on: boolean) => void
}
const ToastContext = createContext<ToastCtx>()
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
  /** Base of the region's generated ids (default: generated). */
  readonly id?: string | undefined
  /** One toast's markup (newest first). */
  readonly children: (toast: ToastSnapshot) => JSX.Element
  readonly messages?: Partial<ToastMessages> | undefined
  /** Default true: rendered in the shared portal. */
  readonly portal?: boolean | undefined
}

/** Provides one toast to its parts. */
function ToastSlot(props: {
  readonly toast: Accessor<ToastSnapshot>
  readonly children: JSX.Element
}) {
  const region = useContext(RegionContext)
  const [rendered, setRendered] = createSignal({ title: false, description: false })
  if (!region) return null
  const ctx: ToastCtx = {
    region,
    toast: reactive(props.toast),
    snapshot: props.toast,
    rendered,
    mount: (part, on) => setRendered((r) => (r[part] === on ? r : { ...r, [part]: on })),
  }
  return <ToastContext.Provider value={ctx}>{props.children}</ToastContext.Provider>
}

/** The region of one store: rendered only while it shows toasts (zag#2988). */
export function Toaster(props: ToasterProps) {
  const env = useEnvironment(announcerCapability, visibilityCapability)
  const instance = useRootId(() => props.id)
  const locale = useLocale(() => undefined)
  const messages = createMemo((): ToastMessages => ({ ...toastMessages, ...props.messages }))
  const [toasts, setToasts] = createSignal<readonly ToastSnapshot[]>(props.toaster.toasts())
  const { view, send } = useMachine(toasterMachine, () => ({
    expand: props.toaster.options.expand,
    onReason: (reason: string, on: boolean) => props.toaster.regionReason(reason as never, on),
  }))
  // Bound to this environment while mounted; the announcer's regions created eagerly. The
  // region renders after mount only: the server and the first client render show no toast
  // (no hydration mismatch, no region before the store is bound).
  const [mounted, setMounted] = createSignal(false)
  afterMount(() => {
    createEffect(() => {
      const store = props.toaster
      setMounted(true)
      setToasts(store.toasts())
      const off = store.subscribe(() => setToasts(store.toasts()))
      const stopPrepare = env.announcer.prepare()
      // Read when the store starts a toast: the latest messages.
      const detach = store.attach(env, { messages: untrack(messages) })
      onCleanup(() => {
        off()
        detach()
        stopPrepare()
      })
    })
  })
  const [regionEl, setRegionEl] = createSignal<HTMLElement | null>(null)
  let tracker: ReturnType<typeof trackToastRegion> | null = null
  afterMount(() => {
    createEffect(() => {
      const visible = toasts().length > 0 && regionEl() !== null
      if (!visible) return
      const t = trackToastRegion(env, {
        region: () => regionEl(),
        toasts: () =>
          Array.from(
            regionEl()?.querySelectorAll<HTMLElement>('[data-scope="toast"][data-part="root"]') ??
              [],
          ),
        hotkey: props.toaster.options.hotkey,
        onEnter: () => send({ type: "HOTKEY" }),
      })
      tracker = t
      onCleanup(() => {
        t.stop()
        tracker = null
      })
    })
  })
  // Stable across updates: the toasts' swipe effects depend on them (a re-run mid-drag would
  // stop the gesture).
  let stable: readonly SwipeDirection[] = []
  const swipeDirections = createMemo(() => {
    const next =
      props.toaster.options.swipeDirections ??
      defaultDirections(props.toaster.options.placement, locale().dir)
    if (next.join(",") !== stable.join(",")) stable = next
    return stable
  })
  const api = createMemo(() =>
    toasterConnect({
      instance: instance(),
      placement: props.toaster.options.placement,
      toasts: toasts(),
      expanded: view().matches("expanded") || props.toaster.options.expand,
      paused: view().context.hovered || view().context.focused,
      gap: props.toaster.options.gap,
      hotkey: props.toaster.options.hotkey,
      messages: messages(),
    }),
  )
  const ctx: RegionCtx = {
    get store() {
      return props.toaster
    },
    api,
    swipeDirections,
    setSwiping: (active) => send({ type: "SWIPING", active }),
    leaving: (el) => tracker?.leaving(el),
  }
  const modalityOf = () => env.modality.modality()
  // One slot per toast, keyed by its instance: a changed snapshot updates it in place.
  const instances = createMemo(() => toasts().map((t) => t.instance))
  const region = () => (
    <RegionContext.Provider value={ctx}>
      <section
        {...joinHandlers(normalizeProps(api().region()), {
          // Mouse and pen hover pause and expand; a touch never hovers.
          onPointerEnter: (e: PointerEvent) => {
            if (e.pointerType !== "touch") send({ type: "HOVER.START", modality: "pointer" })
          },
          onPointerLeave: (e: PointerEvent) => {
            if (e.pointerType !== "touch") send({ type: "HOVER.END", modality: "pointer" })
          },
          onFocusIn: (e: FocusEvent) => {
            const el = e.currentTarget as Element
            if (!el.contains(e.relatedTarget as Node | null)) {
              send({ type: "FOCUS.ENTER", modality: modalityOf() })
            }
          },
          onFocusOut: (e: FocusEvent) => {
            const el = e.currentTarget as Element
            if (!el.contains(e.relatedTarget as Node | null)) {
              send({ type: "FOCUS.LEAVE", modality: modalityOf() })
            }
          },
        })}
        ref={setRegionEl}
        dir={locale().dir}
        lang={locale().locale}
      >
        <ol {...normalizeProps(api().list())}>
          <For each={instances()}>
            {(key) => {
              let last: ToastSnapshot | undefined
              const toast = () => {
                last = toasts().find((t) => t.instance === key) ?? last
                return last as ToastSnapshot
              }
              return (
                <ToastSlot toast={toast}>
                  {untrack(() => props.children(reactive(toast)))}
                </ToastSlot>
              )
            }}
          </For>
        </ol>
      </section>
    </RegionContext.Provider>
  )
  const portal = untrack(() => props.portal !== false)
  return (
    <Show when={api().visible && mounted()}>
      {untrack(() => (portal ? <Portal>{region()}</Portal> : region()))}
    </Show>
  )
}

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the toast. */
  readonly render?: RenderProp<ToastSnapshot> | undefined
  readonly children?: JSX.Element
}

export type ToastRootProps = Own<JSX.LiHTMLAttributes<HTMLLIElement>>

function Root(props: ToastRootProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToast("Root")
  const env = useEnvironment()
  const store = ctx.region.store
  const service = createMemo(() => store.service(ctx.snapshot().instance))
  const [node, setNode] = createSignal<HTMLElement | null>(null)
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const open = createMemo(() => ctx.snapshot().state !== "dismissed")
  const presence = usePresence(open, node, {
    // The exit ended: the record goes (presses during the exit keep nothing: mui/base-ui#5135).
    onExitComplete: () => store.remove(untrack(ctx.snapshot).instance),
  })
  // Before it becomes inert for its exit, focus inside moves on (mui/base-ui#3466).
  createComputed(
    on(
      open,
      (o) => {
        const el = untrack(node)
        if (!o && el) ctx.region.leaving(el)
      },
      { defer: true },
    ),
  )
  afterMount(() => {
    // Its layout height, unscaled, on mount and on every resize.
    createEffect(() => {
      const el = node()
      const s = service()
      if (!el || !s) return
      onCleanup(measureToast(el, (height) => s.send({ type: "MEASURED", height })))
    })
    // The swipe: discrete events only; it pauses the toast while in progress.
    const dismissible = createMemo(() => ctx.snapshot().data.dismissible !== false)
    createEffect(() => {
      const s = service()
      ctx.region.swipeDirections()
      if (!s || !dismissible() || !open()) return
      const tracker = trackSwipe(env, {
        element: () => untrack(node),
        directions: () => untrack(ctx.region.swipeDirections),
        prefix: "toast",
        onStart: (e) => {
          s.send({ type: "PAUSE", reason: "swipe" })
          s.send({ type: "SWIPE.START", modality: e.modality })
          ctx.region.setSwiping(true)
        },
        onEnd: (e) => {
          s.send({ type: "SWIPE", ...e })
          s.send({ type: "RESUME", reason: "swipe" })
          ctx.region.setSwiping(false)
          if (s.getSnapshot().state !== "dismissed") tracker.reset()
        },
        onCancel: () => {
          s.send({ type: "SWIPE.CANCEL" })
          s.send({ type: "RESUME", reason: "swipe" })
          ctx.region.setSwiping(false)
        },
      })
      onCleanup(() => tracker.stop())
    })
    // Development: a persistent toast without a close trigger strands touch screen readers.
    createEffect(() => {
      const state = ctx.snapshot().state
      const el = untrack(node)
      if (process.env.NODE_ENV === "production" || !el || state !== "persistent") return
      if (!el.querySelector('[data-part="close-trigger"]')) {
        console.warn(
          `[rind-ui] toast "${ctx.snapshot().data.id}": a persistent toast without Toast.CloseTrigger; touch screen-reader users cannot press Escape or swipe`,
        )
      }
    })
  })
  const merged = createMemo(() => {
    const s = service()
    if (!s) return {}
    return mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.region.api().root(ctx.snapshot(), {
              rendered: ctx.rendered(),
              focused: focused(),
              modality: modality(),
            }),
          ),
          {
            onKeyDown: ctx.region.api().onRootKeyDown(s.send),
            // The toast itself, not its buttons: data-focus(-visible) on the root.
            onFocusIn: (e: FocusEvent) => setFocused(e.target === e.currentTarget),
            onFocusOut: () => setFocused(false),
          },
        ),
        ref: setNode,
      },
      rest,
    )
  })
  const children = () => local.children
  return (
    <Show when={presence.mounted() && service()}>
      {untrack(() =>
        renderPart(local.render, merged, ctx.toast, children, (p) => <li {...p}>{children()}</li>),
      )}
    </Show>
  )
}

function textPart(part: "title" | "description") {
  return function TextPart(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useToast(part === "title" ? "Title" : "Description")
    afterMount(() => {
      ctx.mount(part, true)
      onCleanup(() => ctx.mount(part, false))
    })
    const merged = createMemo(() =>
      mergeProps(normalizeProps(ctx.region.api()[part](ctx.snapshot())), rest),
    )
    const children = () => local.children ?? ctx.snapshot().data[part]
    return renderPart(local.render, merged, ctx.toast, children as () => JSX.Element, (p) => (
      <div {...p}>{children() as JSX.Element}</div>
    ))
  }
}

const Title = textPart("title")
const Description = textPart("description")

function useButton(send: () => void) {
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") send()
    },
  })
  return {
    state: () => ({ focused: focused(), modality: modality(), pressed: press.pressed() }),
    handlers: joinHandlers(press.props, {
      onFocusIn: () => setFocused(true),
      onFocusOut: () => setFocused(false),
    }),
  }
}

export type ToastButtonProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function ActionTrigger(props: ToastButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToast("ActionTrigger")
  const b = useButton(() =>
    ctx.region.store.service(untrack(ctx.snapshot).instance)?.send({
      type: "ACTION_PRESS",
      modality: "pointer",
    }),
  )
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.region.api().actionTrigger(ctx.snapshot(), b.state())),
        b.handlers,
      ),
      rest,
    ),
  )
  const children = () => local.children ?? ctx.snapshot().data.action?.label
  return renderPart(local.render, merged, ctx.toast, children as () => JSX.Element, (p) => (
    <button {...p}>{children() as JSX.Element}</button>
  ))
}

function CloseTrigger(props: ToastButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useToast("CloseTrigger")
  const b = useButton(() =>
    ctx.region.store.service(untrack(ctx.snapshot).instance)?.send({
      type: "CLOSE_TRIGGER_PRESS",
      modality: "pointer",
    }),
  )
  const [el, setEl] = createSignal<Element | null>(null)
  const [empty, setEmpty] = createSignal(false)
  afterMount(() => {
    createEffect(() => {
      const node = el()
      if (!node) return
      const read = () => setEmpty((node.textContent ?? "").trim() === "")
      read()
      const observer = new MutationObserver(read)
      observer.observe(node, { childList: true, characterData: true, subtree: true })
      onCleanup(() => observer.disconnect())
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.region.api().closeTrigger(ctx.snapshot(), { ...b.state(), empty: empty() }),
          ),
          b.handlers,
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.toast, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The parts, by name: `toast.parts.ts` re-exports them as the `Toast` namespace. */
export { ActionTrigger, CloseTrigger, Description, Root, Title }
