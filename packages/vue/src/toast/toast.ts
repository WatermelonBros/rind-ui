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
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal } from "../portal"
import { useEnvironment, useLocale } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

interface RegionCtx {
  readonly store: ToasterStore
  readonly api: () => ReturnType<typeof toasterConnect>
  readonly swipeDirections: () => readonly SwipeDirection[]
  readonly setSwiping: (active: boolean) => void
  readonly leaving: (el: HTMLElement) => void
}
const RegionKey: InjectionKey<RegionCtx> = Symbol("rind-ui.toaster")

interface ToastCtx {
  readonly region: RegionCtx
  readonly toast: () => ToastSnapshot
  readonly rendered: () => { readonly title: boolean; readonly description: boolean }
  readonly mount: (part: "title" | "description", on: boolean) => void
}
const ToastKey: InjectionKey<ToastCtx> = Symbol("rind-ui.toast")
function useToast(part: string): ToastCtx {
  const ctx = inject(ToastKey, null)
  if (!ctx) throw new Error(`Toast.${part} must be inside Toast.Root`)
  return ctx
}

/** The default swipe: the placement's edge and the inline end. */
function defaultDirections(placement: string, dir: "ltr" | "rtl"): SwipeDirection[] {
  const edge: SwipeDirection = placement.startsWith("top") ? "up" : "down"
  return [edge, dir === "rtl" ? "left" : "right"]
}

/** Provides one toast to its parts. */
const ToastSlot = defineComponent({
  name: "ToastSlot",
  props: { toast: { type: Object as PropType<ToastSnapshot>, required: true } },
  setup(props, { slots }) {
    const region = inject(RegionKey, null)
    const rendered = shallowRef({ title: false, description: false })
    if (region) {
      provide(ToastKey, {
        region,
        toast: () => props.toast,
        rendered: () => rendered.value,
        mount: (part, on) => {
          if (rendered.value[part] !== on) rendered.value = { ...rendered.value, [part]: on }
        },
      })
    }
    return () => (region ? slots["default"]?.() : null)
  },
})

/** The region of one store: rendered only while it shows toasts (zag#2988). */
export const Toaster = defineComponent({
  name: "RindToaster",
  props: {
    toaster: { type: Object as PropType<ToasterStore>, required: true },
    /** Base of the region's generated ids (default: a `useId`). */
    id: String,
    messages: Object as PropType<Partial<ToastMessages>>,
    /** Default true: rendered in the shared portal. */
    portal: { type: Boolean, default: true },
  },
  slots: Object as SlotsType<{
    /** One toast's markup (newest first). */
    default: (toast: ToastSnapshot) => VNodeChild
  }>,
  setup(props, { slots }) {
    const env = useEnvironment(announcerCapability, visibilityCapability)
    const instance = useRootId(() => props.id)
    const locale = useLocale(() => undefined)
    const messages = computed((): ToastMessages => ({ ...toastMessages, ...props.messages }))
    const toasts = shallowRef<readonly ToastSnapshot[]>(props.toaster.toasts())
    const { view, send } = useMachine(toasterMachine, () => ({
      expand: props.toaster.options.expand,
      onReason: (reason, on) => props.toaster.regionReason(reason, on),
    }))
    // Bound to this environment while mounted; the announcer's regions created eagerly. The
    // region renders after mount only: the server and the first client render show no toast
    // (no hydration mismatch, no region before the store is bound).
    const mounted = shallowRef(false)
    onMounted(() =>
      watch(
        () => props.toaster,
        (store, _, onCleanup) => {
          mounted.value = true
          toasts.value = store.toasts()
          const off = store.subscribe(() => (toasts.value = store.toasts()))
          const stopPrepare = env.announcer.prepare()
          // Read when the store starts a toast: the latest messages.
          const detach = store.attach(env, { messages: messages.value })
          onCleanup(() => {
            off()
            detach()
            stopPrepare()
          })
        },
        { immediate: true },
      ),
    )
    const regionEl = shallowRef<Element | null>(null)
    let tracker: ReturnType<typeof trackToastRegion> | null = null
    onMounted(() =>
      watch(
        () => toasts.value.length > 0 && regionEl.value !== null,
        (visible, _, onCleanup) => {
          if (!visible) return
          const t = trackToastRegion(env, {
            region: () => regionEl.value as HTMLElement | null,
            toasts: () =>
              Array.from(
                regionEl.value?.querySelectorAll<HTMLElement>(
                  '[data-scope="toast"][data-part="root"]',
                ) ?? [],
              ),
            hotkey: props.toaster.options.hotkey,
            onEnter: () => send({ type: "HOTKEY" }),
          })
          tracker = t
          onCleanup(() => {
            t.stop()
            tracker = null
          })
        },
        { immediate: true, flush: "post" },
      ),
    )
    // Stable across renders: the toasts' swipe effects depend on them (a re-run mid-drag
    // would stop the gesture).
    let stable: readonly SwipeDirection[] = []
    const swipeDirections = computed(() => {
      const next =
        props.toaster.options.swipeDirections ??
        defaultDirections(props.toaster.options.placement, locale.value.dir)
      if (next.join(",") !== stable.join(",")) stable = next
      return stable
    })
    const api = computed(() =>
      toasterConnect({
        instance: instance(),
        placement: props.toaster.options.placement,
        toasts: toasts.value,
        expanded: view.value.matches("expanded") || props.toaster.options.expand,
        paused: view.value.context.hovered || view.value.context.focused,
        gap: props.toaster.options.gap,
        hotkey: props.toaster.options.hotkey,
        messages: messages.value,
      }),
    )
    provide(RegionKey, {
      store: props.toaster,
      api: () => api.value,
      swipeDirections: () => swipeDirections.value,
      setSwiping: (active) => send({ type: "SWIPING", active }),
      leaving: (el) => tracker?.leaving(el),
    })
    const modalityOf = () => env.modality.modality()
    return () => {
      if (!api.value.visible || !mounted.value) return null
      const region = h(
        "section",
        {
          ...joinHandlers(normalizeProps(api.value.region()), {
            // Mouse and pen hover pause and expand; a touch never hovers.
            onPointerenter: (e: PointerEvent) => {
              if (e.pointerType !== "touch") send({ type: "HOVER.START", modality: "pointer" })
            },
            onPointerleave: (e: PointerEvent) => {
              if (e.pointerType !== "touch") send({ type: "HOVER.END", modality: "pointer" })
            },
            onFocusin: (e: FocusEvent) => {
              const el = e.currentTarget as Element
              if (!el.contains(e.relatedTarget as Node | null)) {
                send({ type: "FOCUS.ENTER", modality: modalityOf() })
              }
            },
            onFocusout: (e: FocusEvent) => {
              const el = e.currentTarget as Element
              if (!el.contains(e.relatedTarget as Node | null)) {
                send({ type: "FOCUS.LEAVE", modality: modalityOf() })
              }
            },
          }),
          ref: refTo(regionEl),
          dir: locale.value.dir,
          lang: locale.value.locale,
        },
        [
          h(
            "ol",
            normalizeProps(api.value.list()),
            toasts.value.map((t) =>
              h(ToastSlot, { key: t.instance, toast: t }, () => slots.default(t)),
            ),
          ),
        ],
      )
      return props.portal ? h(Portal, null, () => region) : region
    }
  },
})

type Slots = SlotsType<{ default?: (toast: ToastSnapshot) => VNodeChild }>

const Root = defineComponent({
  name: "ToastRoot",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToast("Root")
    const env = useEnvironment()
    const store = ctx.region.store
    const service = () => store.service(ctx.toast().instance)
    const el = shallowRef<Element | null>(null)
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const open = () => ctx.toast().state !== "dismissed"
    const presence = usePresence(open, el, {
      // The exit ended: the record goes (presses during the exit keep nothing: mui/base-ui#5135).
      onExitComplete: () => store.remove(ctx.toast().instance),
    })
    onMounted(() => {
      // Before it becomes inert for its exit, focus inside moves on (mui/base-ui#3466).
      watch(
        open,
        (o) => {
          if (!o && el.value instanceof HTMLElement) ctx.region.leaving(el.value)
        },
        { flush: "pre" },
      )
      // Its layout height, unscaled, on mount and on every resize.
      watch(
        [() => el.value, service] as const,
        ([node, s], _, onCleanup) => {
          if (!(node instanceof HTMLElement) || !s) return
          onCleanup(measureToast(node, (height) => s.send({ type: "MEASURED", height })))
        },
        { immediate: true, flush: "post" },
      )
      // The swipe: discrete events only; it pauses the toast while in progress.
      watch(
        [
          service,
          () => ctx.toast().data.dismissible !== false,
          open,
          ctx.region.swipeDirections,
        ] as const,
        ([s, dismissible, isOpen], _, onCleanup) => {
          if (!s || !dismissible || !isOpen) return
          const tracker = trackSwipe(env, {
            element: () => el.value as HTMLElement | null,
            directions: () => ctx.region.swipeDirections(),
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
        },
        { immediate: true, flush: "post" },
      )
      // Development: a persistent toast without a close trigger strands touch screen readers.
      watch(
        () => ctx.toast().state,
        (state) => {
          const node = el.value
          if (process.env.NODE_ENV === "production" || !node || state !== "persistent") return
          if (!node.querySelector('[data-part="close-trigger"]')) {
            console.warn(
              `[rind-ui] toast "${ctx.toast().data.id}": a persistent toast without Toast.CloseTrigger; touch screen-reader users cannot press Escape or swipe`,
            )
          }
        },
        { immediate: true, flush: "post" },
      )
    })
    return () => {
      const s = service()
      if (!presence.mounted || !s) return null
      const toast = ctx.toast()
      const own = normalizeProps(
        ctx.region.api().root(toast, {
          rendered: ctx.rendered(),
          focused: focused.value,
          modality: modality.value,
        }),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(own, {
            onKeydown: ctx.region.api().onRootKeyDown(s.send),
            // The toast itself, not its buttons: data-focus(-visible) on the root.
            onFocusin: (e: FocusEvent) => (focused.value = e.target === e.currentTarget),
            onFocusout: () => (focused.value = false),
          }),
          ref: refTo(el),
        },
        attrs,
      )
      return renderPart("li", merged, slots.default?.(toast), props.asChild)
    }
  },
})

function textPart(name: "Title" | "Description", part: "title" | "description") {
  return defineComponent({
    name: `Toast${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useToast(name)
      onMounted(() => ctx.mount(part, true))
      onBeforeUnmount(() => ctx.mount(part, false))
      return () => {
        const toast = ctx.toast()
        return renderPart(
          "div",
          mergeProps(normalizeProps(ctx.region.api()[part](toast)), attrs),
          slots.default?.(toast) ?? toast.data[part],
          props.asChild,
        )
      }
    },
  })
}

const Title = textPart("Title", "title")
const Description = textPart("Description", "description")

function useButton(send: () => void) {
  const env = useEnvironment()
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") send()
    },
  })
  return {
    state: () => ({
      focused: focused.value,
      modality: modality.value,
      pressed: press.pressed.value,
    }),
    handlers: joinHandlers(press.props, {
      onFocus: () => (focused.value = true),
      onBlur: () => (focused.value = false),
    }),
  }
}

const ActionTrigger = defineComponent({
  name: "ToastActionTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToast("ActionTrigger")
    const b = useButton(() =>
      ctx.region.store
        .service(ctx.toast().instance)
        ?.send({ type: "ACTION_PRESS", modality: "pointer" }),
    )
    return () => {
      const toast = ctx.toast()
      const own = normalizeProps(ctx.region.api().actionTrigger(toast, b.state()))
      return renderPart(
        "button",
        mergeProps(joinHandlers(own, b.handlers), attrs),
        slots.default?.(toast) ?? toast.data.action?.label,
        props.asChild,
      )
    }
  },
})

const CloseTrigger = defineComponent({
  name: "ToastCloseTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useToast("CloseTrigger")
    const b = useButton(() =>
      ctx.region.store
        .service(ctx.toast().instance)
        ?.send({ type: "CLOSE_TRIGGER_PRESS", modality: "pointer" }),
    )
    const el = shallowRef<Element | null>(null)
    const empty = shallowRef(false)
    const measure = () => (empty.value = (el.value?.textContent ?? "").trim() === "")
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const toast = ctx.toast()
      const own = normalizeProps(
        ctx.region.api().closeTrigger(toast, { ...b.state(), empty: empty.value }),
      )
      return renderPart(
        "button",
        mergeProps({ ...joinHandlers(own, b.handlers), ref: refTo(el) }, attrs),
        slots.default?.(toast),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `toast.parts.ts` re-exports them as the `Toast` namespace. */
export { ActionTrigger, CloseTrigger, Description, Root, Title }
