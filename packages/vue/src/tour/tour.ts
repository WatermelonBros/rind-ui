// Tour: a guided tour over the page, steps that point at real elements or centred dialogs.
// `useTour` owns the machine; Root provides it (its own, or a `tour` handle) to the parts.
// Wiring only: the machine owns the run, the core parts own every attribute.
import {
  announcerCapability,
  domPositioning,
  getLayerStack,
  type HeadingLevel,
  isAnchoredTourStep,
  isStepModal,
  type LayerMeta,
  type MessageOverrides,
  type Modality,
  partId,
  resolveStep,
  type Service,
  type TourAction,
  type TourCloseReason,
  type TourContext,
  type TourDirection,
  type TourMachineState,
  type TourMessages,
  type TourProps,
  type TourStep,
  tourConnect,
  tourIds,
  tourLayerId,
  tourMachine,
  tourMessages,
  tourProgress,
  tourStepIndex,
} from "@rind-ui/core"
import {
  defineComponent,
  h,
  type InjectionKey,
  inject,
  type MaybeRefOrGetter,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  toValue,
  type VNodeChild,
  watch,
} from "vue"
import { provideHeadingSection } from "../heading/heading"
import { joinHandlers } from "../join-handlers"
import { keepStyle } from "../keep-style"
import { provideLayer, useParentLayer } from "../layer-context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    tour: TourMessages
  }
}

/** A step with Vue content. */
export type TourStepDef = TourStep<VNodeChild>

/** What `openChange` receives. */
export interface TourOpenChangeDetails {
  readonly reason: TourCloseReason | "api"
  readonly stepId: string | null
  readonly stepIndex: number
  /** True only for reason `complete`. */
  readonly complete: boolean
  cancel(): void
}

/** What `stepChange` receives. */
export interface TourStepChangeDetails {
  readonly stepIndex: number
  /** Steps that are not wait steps. */
  readonly totalSteps: number
  /** 0–1, over the steps that are not wait steps. */
  readonly progress: number
  readonly direction: TourDirection
  readonly reason: "start" | "next" | "prev" | "goto"
  cancel(): void
}

export type UseTourProps = Omit<
  TourProps,
  "root" | "parent" | "steps" | "messages" | "onOpenChange" | "stepId" | "onStepIdChange"
> & {
  /** Base for the ids of the tour's parts. Default: generated. */
  readonly id?: string | undefined
  readonly steps: readonly TourStepDef[]
  readonly stepId?: string | null | undefined
  readonly onOpenChange?: ((open: boolean, details: TourOpenChangeDetails) => void) | undefined
  readonly onStepChange?: ((stepId: string, details: TourStepChangeDetails) => void) | undefined
  readonly messages?: MessageOverrides<TourMessages> | undefined
}

/** What `useTour` returns and `Tour.Root :tour` accepts; the getters stay reactive. */
export interface TourHandle {
  readonly service: Service<typeof tourMachine>
  readonly root: string
  readonly props: TourProps
  readonly messages: TourMessages
  /** The tour runs (a step is prepared, shown or waited on). */
  readonly open: boolean
  /** The shown step's id, or null. */
  readonly stepId: string | null
  /** The shown step's 0-based index, or -1. */
  readonly stepIndex: number
  readonly steps: readonly TourStepDef[]
  /** Opens at the first step, or at `stepId`; while open, goes to that step. */
  start(options?: { readonly stepId?: string }): void
  /** Ends the tour with reason `api`. */
  stop(): void
  next(): void
  prev(): void
  goto(id: string): void
  /** Recomputes the card and spotlight now (a target that moved without any event). */
  reposition(): void
  setSteps(steps: readonly TourStepDef[]): void
  addStep(step: TourStepDef, index?: number): void
  removeStep(id: string): void
  updateStep(id: string, patch: Partial<Omit<TourStepDef, "id">>): void
}

const reasonOf = (direction: TourDirection, started: boolean) =>
  started ? "start" : direction === "jump" ? "goto" : direction === "backward" ? "prev" : "next"

/** The tour's API: pass it to `Tour.Root :tour`, or render `Tour.Root` with the props. */
export function useTour(options: MaybeRefOrGetter<UseTourProps>): TourHandle {
  const o = () => toValue(options)
  const root = useRootId(() => o().id)
  const parent = useParentLayer()
  const messages = useMessages("tour", tourMessages, () => o().messages)
  const env = useEnvironment(announcerCapability)
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = { ...env, position: domPositioning(env) }
  // The steps: the option, or what the mutators set since it last changed.
  const override = shallowRef<readonly TourStepDef[] | null>(null)
  watch(
    () => o().steps,
    () => (override.value = null),
  )
  const steps = () => override.value ?? o().steps
  let service: Service<typeof tourMachine> | null = null
  const read = () => {
    const view = service?.view()
    return {
      shown: (view?.values.stepId as string | undefined) || null,
      context: service?.getSnapshot().context as TourContext | undefined,
    }
  }
  const props = (): TourProps => {
    const {
      id: _id,
      steps: _steps,
      messages: _messages,
      onOpenChange,
      onStepChange,
      stepId,
      defaultStepId,
      ...rest
    } = o()
    const list = steps()
    return {
      ...rest,
      root: root(),
      parent: parent(),
      steps: list,
      messages: messages.value,
      // Not `defaultStepId`: the first shown step of every run is reported to stepChange.
      ...(defaultStepId === undefined ? {} : { firstStepId: defaultStepId }),
      ...(stepId === undefined ? {} : { stepId: stepId ?? "" }),
      onOpenChange: onOpenChange
        ? (open, d) => {
            const { shown } = read()
            const reason = open ? "api" : (d.reason as TourCloseReason)
            onOpenChange(open, {
              reason,
              stepId: shown,
              stepIndex: tourStepIndex(list, shown),
              complete: reason === "complete",
              cancel: d.cancel,
            })
          }
        : undefined,
      onStepIdChange: onStepChange
        ? (next, d) => {
            const { shown, context } = read()
            const p = tourProgress(list, next)
            const direction = context?.direction ?? "forward"
            onStepChange(next, {
              stepIndex: tourStepIndex(list, next),
              totalSteps: p.total,
              progress: p.progress,
              direction,
              reason: reasonOf(direction, shown === null),
              cancel: d.cancel,
            })
          }
        : undefined,
    }
  }
  const machine = useMachine(tourMachine, props, withPosition)
  service = machine.service
  const { view, send } = machine
  const shown = () => (view.value.values.stepId as string) || null
  return {
    service: machine.service,
    get root() {
      return root()
    },
    get props() {
      return props()
    },
    get messages() {
      return messages.value
    },
    get open() {
      return view.value.values.open as boolean
    },
    get stepId() {
      return view.value.matches("idle") ? null : shown()
    },
    get stepIndex() {
      return view.value.matches("idle") ? -1 : tourStepIndex(steps(), shown())
    },
    get steps() {
      return steps()
    },
    start: (s) => send({ type: "START", stepId: s?.stepId }),
    stop: () => send({ type: "api" }),
    next: () => send({ type: "STEP.NEXT" }),
    prev: () => send({ type: "STEP.PREV" }),
    goto: (to) => send({ type: "STEP.GOTO", id: to }),
    reposition: () => send({ type: "POSITION.REPOSITION" }),
    setSteps: (list) => (override.value = list),
    addStep: (step, index) => {
      const list = [...steps()]
      list.splice(index ?? list.length, 0, step)
      override.value = list
    },
    removeStep: (rid) => (override.value = steps().filter((x) => x.id !== rid)),
    updateStep: (uid, patch) =>
      (override.value = steps().map((x) => (x.id === uid ? { ...x, ...patch, id: x.id } : x))),
  }
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

interface Ctx {
  readonly tour: TourHandle
  /** The machine's view, followed reactively (the handle's service notifies on change). */
  readonly view: ShallowRef<ReturnType<Service<typeof tourMachine>["view"]>>
  readonly contentMounted: ShallowRef<boolean>
  readonly titleLevel: ShallowRef<HeadingLevel>
  readonly rendered: ShallowRef<Rendered>
  readonly meta: ShallowRef<LayerMeta | undefined>
}

const TourKey: InjectionKey<Ctx> = Symbol("rind-ui.tour")
function useTourCtx(part: string): Ctx {
  const ctx = inject(TourKey, null)
  if (!ctx) throw new Error(`Tour.${part} must be inside Tour.Root`)
  return ctx
}

type Extra = {
  dir?: "ltr" | "rtl"
  focusWithin?: boolean
  contentFocused?: boolean
  modality?: Parameters<typeof tourConnect>[0]["modality"]
}

/** The tour's connect and the shown step: call during render. */
function useApi(ctx: Ctx, extra: Extra = {}) {
  const { tour } = ctx
  const view = ctx.view.value
  const state = view.state as TourMachineState
  const context = view.context as TourContext
  const step = resolveStep(tour.props, context.patches, view.values.stepId as string) as
    | TourStepDef
    | undefined
  const centered = !step || context.targetMissing || !isAnchoredTourStep(step)
  return {
    state,
    step,
    api: tourConnect(
      {
        instance: tour.root,
        state,
        steps: tour.props.steps,
        step,
        targetMissing: context.targetMissing,
        modal: !!step && isStepModal(tour.props, step, centered),
        placement: context.placement,
        closeReason: context.closeReason,
        shownOnce: context.shownOnce,
        stepChanging: context.stepChanging,
        preventTargetInteraction: tour.props.preventTargetInteraction === true,
        rendered: ctx.rendered.value,
        contentMounted: ctx.contentMounted.value,
        meta: ctx.meta.value,
        ...extra,
        messages: tour.messages,
      },
      tour.service.send,
    ),
  }
}

/** Provides a handle to the parts below. */
function provideTour(tour: TourHandle) {
  const env = useEnvironment()
  const view = shallowRef(tour.service.view())
  onMounted(() => {
    view.value = tour.service.view()
    onBeforeUnmount(tour.service.subscribe(() => (view.value = tour.service.view())))
  })
  const ctx: Ctx = {
    tour,
    view,
    contentMounted: shallowRef(false),
    titleLevel: shallowRef<HeadingLevel>(2),
    rendered: shallowRef<Rendered>({}),
    meta: shallowRef(undefined),
  }
  // The stack's metadata for this tour's layer, followed while a step is shown.
  onMounted(() =>
    watch(
      () => view.value.state === "active",
      (active, _, onCleanup) => {
        ctx.meta.value = undefined
        if (!active) return
        const node = env.dom.getRootNode()
        const stack = getLayerStack("body" in node ? node : node.ownerDocument)
        const read = () => (ctx.meta.value = stack.get(tourLayerId(tour.root))?.meta())
        read()
        onCleanup(stack.subscribe(read))
      },
      { immediate: true },
    ),
  )
  provide(TourKey, ctx)
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>
const flag = { type: Boolean, default: undefined }

/** A Root given a `tour` handle: it provides it. */
const HandleRoot = defineComponent({
  name: "TourHandleRoot",
  props: { tour: { type: Object as PropType<TourHandle>, required: true } },
  setup(props, { slots }) {
    provideTour(props.tour)
    return () => slots["default"]?.()
  },
})

const OwnRoot = defineComponent({
  name: "TourOwnRoot",
  props: {
    id: String,
    steps: { type: Array as PropType<readonly TourStepDef[]>, required: true },
    open: flag,
    defaultOpen: flag,
    stepId: { type: [String, null] as PropType<string | null>, default: undefined },
    defaultStepId: String,
    modal: flag,
    closeOnEscape: flag,
    closeOnOutsidePress: flag,
    closeOnOutsideFocus: flag,
    keyboardNavigation: flag,
    prepareTimeout: Number,
    preventTargetInteraction: flag,
    spotlight: Object as PropType<TourProps["spotlight"]>,
    initialFocus: {
      type: [Function, null] as PropType<TourProps["initialFocus"]>,
      default: undefined,
    },
    finalFocus: {
      type: [Function, Boolean, null] as PropType<TourProps["finalFocus"]>,
      default: undefined,
    },
    onMissingTarget: Function as PropType<TourProps["onMissingTarget"]>,
    persistentElements: Function as PropType<TourProps["persistentElements"]>,
    messages: Object as PropType<MessageOverrides<TourMessages>>,
    onOpenChange: Function as PropType<UseTourProps["onOpenChange"]>,
    onStepChange: Function as PropType<UseTourProps["onStepChange"]>,
    "onUpdate:open": Function as PropType<(open: boolean) => void>,
    "onUpdate:stepId": Function as PropType<(stepId: string) => void>,
  },
  setup(props, { slots }) {
    const tour = useTour(() => {
      const {
        onOpenChange,
        onStepChange,
        "onUpdate:open": updateOpen,
        "onUpdate:stepId": updateStep,
        ...rest
      } = props
      // Sound: Vue props hold `undefined` for the absent ones (UseTourProps' optional keys).
      return {
        ...(rest as UseTourProps),
        onOpenChange:
          onOpenChange || updateOpen
            ? (o: boolean, d: TourOpenChangeDetails) => {
                onOpenChange?.(o, d)
                updateOpen?.(o)
              }
            : undefined,
        onStepChange:
          onStepChange || updateStep
            ? (s: string, d: TourStepChangeDetails) => {
                onStepChange?.(s, d)
                updateStep?.(s)
              }
            : undefined,
      }
    })
    provideTour(tour)
    return () => slots["default"]?.()
  },
})

/** The tour's provider: given a `tour` handle (`useTour`), or the tour's own props. */
const Root = defineComponent({
  name: "TourRoot",
  inheritAttrs: false,
  props: { tour: Object as PropType<TourHandle> },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    return () =>
      props.tour
        ? h(HandleRoot, { tour: props.tour }, slots)
        : // Sound: without `tour`, the attributes are the tour's own props.
          h(OwnRoot, attrs as never, slots)
  },
})

/** A button-like part: focus, modality and press, from `connect(…)`. */
function useButton(onPress: (modality: Modality) => void) {
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the part is mounted.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
  })
  const handlers = {
    onFocus: () => (focused.value = true),
    onBlur: () => (focused.value = false),
  }
  return { focused, modality, press, handlers }
}

/** Whether the element renders no content of its own (an icon-only button). */
function useEmpty(el: ShallowRef<Element | null>) {
  const empty = shallowRef(false)
  const check = () => (empty.value = (el.value?.textContent ?? "").trim() === "")
  onMounted(check)
  onUpdated(check)
  return empty
}

export interface TourTriggerState {
  readonly open: boolean
}

const Trigger = defineComponent({
  name: "TourTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<TourTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Trigger")
    const b = useButton((m) => useApi(ctx).api.pressTrigger(m))
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const { api } = useApi(ctx)
      const children = slots.default?.({ open: api.open })
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const own = normalizeProps(
        api.trigger({
          focused: b.focused.value,
          modality: b.modality.value,
          pressed: b.press.pressed.value,
          tag,
        }),
      )
      return renderPart(
        "button",
        mergeProps({ ...joinHandlers(own, b.press.props, b.handlers), ref: refTo(el) }, attrs),
        children,
        props.asChild,
      )
    }
  },
})

/** The Portal with the trigger as its logical parent: the host carries its theme, dir and lang. */
const Portal = defineComponent({
  name: "TourPortal",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const ctx = useTourCtx("Portal")
    const env = useEnvironment()
    const logicalParent = () => env.dom.getById(tourIds(ctx.tour.root).trigger)
    return () => h(PortalPart, { logicalParent, ...attrs }, slots)
  },
})

const Backdrop = defineComponent({
  name: "TourBackdrop",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Backdrop")
    // Mounted after hydration only: a `defaultOpen` tour renders nothing on the server.
    const hydrated = shallowRef(false)
    onMounted(() => (hydrated.value = true))
    const el = shallowRef<Element | null>(null)
    // The tour's whole run: the same node between steps (no flash).
    const presence = usePresence(() => useApi(ctx).api.open, el)
    return () => {
      if (!presence.mounted || !hydrated.value) return null
      return renderPart(
        "div",
        mergeProps({ ...normalizeProps(useApi(ctx).api.backdrop()), ref: refTo(el) }, attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

const Spotlight = defineComponent({
  name: "TourSpotlight",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Spotlight")
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(() => {
      const { api, state } = useApi(ctx)
      return state === "active" && !api.centered
    }, el)
    // The step change ends with the spotlight's own transition, or with the first scroll or
    // resize once nothing animates any more (the step's own scrollIntoView does not end it).
    onMounted(() =>
      watch(
        [() => (ctx.view.value.context as TourContext).stepChanging, () => presence.mounted, el],
        ([changing, mounted, node], _, onCleanup) => {
          const target = node as HTMLElement | null
          if (!changing || !mounted || !target) return
          const settle = () => ctx.tour.service.send({ type: "SPOTLIGHT.SETTLED" })
          const view = target.ownerDocument.defaultView
          const onTransition = (e: Event) => {
            if (e.target === target) settle()
          }
          const onMove = () => {
            if (!target.getAnimations?.().length) settle()
          }
          target.addEventListener("transitionend", onTransition)
          target.addEventListener("transitioncancel", onTransition)
          view?.addEventListener("scroll", onMove, { capture: true, passive: true })
          view?.addEventListener("resize", onMove)
          onCleanup(() => {
            target.removeEventListener("transitionend", onTransition)
            target.removeEventListener("transitioncancel", onTransition)
            view?.removeEventListener("scroll", onMove, { capture: true })
            view?.removeEventListener("resize", onMove)
          })
        },
        { immediate: true, flush: "post" },
      ),
    )
    // Positioning writes to this element's style too.
    const kept = keepStyle()
    return () => {
      if (!presence.mounted) return null
      const merged = mergeProps(
        { ...normalizeProps(useApi(ctx).api.spotlight()), ref: refTo(el) },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

const Positioner = defineComponent({
  name: "TourPositioner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Positioner")
    const shown = () => ctx.view.value.state === "active"
    // The target's direction: the portalled positioner carries it (inline sides, RTL).
    const dir = shallowRef<"ltr" | "rtl" | undefined>(undefined)
    onMounted(() =>
      watch(
        [shown, () => useApi(ctx).step],
        ([on, step]) => {
          if (!on) return
          const anchor = step?.target?.() ?? document.getElementById(tourIds(ctx.tour.root).trigger)
          const found = anchor?.closest("[dir]")?.getAttribute("dir")
          dir.value = found === "rtl" ? "rtl" : "ltr"
        },
        { immediate: true, flush: "post" },
      ),
    )
    const el = shallowRef<Element | null>(null)
    // It holds the content: it stays while the content's exit animations run.
    const presence = usePresence(shown, el, { subtree: () => true })
    // Positioning writes to this element's style too.
    const kept = keepStyle()
    return () => {
      if (!presence.mounted) return null
      const { api } = useApi(ctx, dir.value ? { dir: dir.value } : {})
      const merged = mergeProps({ ...normalizeProps(api.positioner()), ref: refTo(el) }, attrs)
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

export interface TourContentState {
  readonly open: boolean
  readonly stepId: string | null
}

const Content = defineComponent({
  name: "TourContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<TourContentState>,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Content")
    const env = useEnvironment()
    // Headings inside the card are one level below the title; layers opened from here are
    // the tour's children.
    provideLayer(
      () => tourLayerId(ctx.tour.root),
      () => "tour",
    )
    provideHeadingSection(() => Math.min(6, ctx.titleLevel.value + 1) as HeadingLevel)
    const focusWithin = shallowRef(false)
    const contentFocused = shallowRef(false)
    const modality = useModality(env.modality, () => contentFocused.value)
    const shown = () => ctx.view.value.state === "active"
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(shown, el)
    watch(
      () => presence.mounted,
      (m, _, onCleanup) => {
        if (!m) return
        ctx.contentMounted.value = true
        onCleanup(() => (ctx.contentMounted.value = false))
      },
      { immediate: true },
    )
    // Focus within, from the DOM itself (native events plus a frame check).
    onMounted(() =>
      watch(
        [() => presence.mounted, el],
        ([mounted, node], _, onCleanup) => {
          const target = node as HTMLElement | null
          if (!mounted || !target) return
          const sync = () => {
            const active = target.ownerDocument.activeElement
            focusWithin.value = active !== null && target.contains(active)
            contentFocused.value = active === target
          }
          const onFocusOut = (e: FocusEvent) => {
            const next = e.relatedTarget as Node | null
            if (next && target.contains(next)) return
            focusWithin.value = false
            contentFocused.value = false
          }
          sync()
          const frame = env.scheduler.requestAnimationFrame(sync)
          target.addEventListener("focusin", sync)
          target.addEventListener("focusout", onFocusOut)
          onCleanup(() => {
            env.scheduler.cancelAnimationFrame(frame)
            target.removeEventListener("focusin", sync)
            target.removeEventListener("focusout", onFocusOut)
          })
        },
        { immediate: true, flush: "post" },
      ),
    )
    return () => {
      if (!presence.mounted) return null
      const {
        "aria-label": label,
        "aria-labelledby": labelledBy,
        "aria-describedby": describedBy,
        ...rest
      } = attrs as Record<string, string | undefined>
      const { api, step } = useApi(ctx, {
        focusWithin: focusWithin.value,
        contentFocused: contentFocused.value,
        modality: modality.value,
      })
      const open = shown()
      const exiting = !open && presence.state === "exiting"
      return renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.content({ label, labelledBy, describedBy })),
            // Once closing, the card is inert.
            ...(exiting ? { inert: "" } : {}),
            ref: refTo(el),
          },
          rest,
        ),
        slots.default?.({ open, stepId: step?.id ?? null }),
        props.asChild,
      )
    }
  },
})

const Arrow = defineComponent({
  name: "TourArrow",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Arrow")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(useApi(ctx).api.arrow()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** Registers a title/description part with the Root while it is mounted. */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  const id = partId("tour", ctx.tour.root, part)
  onMounted(() => (ctx.rendered.value = { ...ctx.rendered.value, [part]: id }))
  onBeforeUnmount(() => (ctx.rendered.value = { ...ctx.rendered.value, [part]: undefined }))
}

/** The step's title: its slot, or the shown step's `title`. */
const Title = defineComponent({
  name: "TourTitle",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The heading level (default 2); headings in the card are one level below. */
    level: { type: Number as PropType<HeadingLevel>, default: 2 },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Title")
    useRegistered(ctx, "title")
    watch(
      () => props.level,
      (l) => (ctx.titleLevel.value = l),
      { immediate: true },
    )
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const { api, step } = useApi(ctx)
      const children = slots.default?.() ?? step?.title
      const fallback = `h${props.level}`
      const tag = renderedTag(fallback, children, props.asChild, measured.value)
      return renderPart(
        fallback,
        mergeProps(
          { ...normalizeProps(api.title({ level: props.level, tag })), ref: refTo(el) },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

/** The step's description: its slot, or the shown step's `description`. */
const Description = defineComponent({
  name: "TourDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("Description")
    useRegistered(ctx, "description")
    return () => {
      const { api, step } = useApi(ctx)
      return renderPart(
        "p",
        mergeProps(normalizeProps(api.description()), attrs),
        slots.default?.() ?? step?.description,
        props.asChild,
      )
    }
  },
})

const ProgressText = defineComponent({
  name: "TourProgressText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("ProgressText")
    return () => {
      const { api } = useApi(ctx)
      return renderPart(
        "span",
        mergeProps(normalizeProps(api.progressText()), attrs),
        slots.default?.() ?? api.progressLabel(),
        props.asChild,
      )
    }
  },
})

/** Renders its slot with the shown step's actions. */
const Actions = defineComponent({
  name: "TourActions",
  slots: Object as SlotsType<{
    /** Renders the shown step's actions. */
    default: (actions: readonly TourAction<VNodeChild>[]) => VNodeChild
  }>,
  setup(_, { slots }) {
    const ctx = useTourCtx("Actions")
    // Sound: the steps are TourStepDef, whose actions carry Vue labels.
    return () => slots.default(useApi(ctx).api.actions as readonly TourAction<VNodeChild>[])
  },
})

const ActionTrigger = defineComponent({
  name: "TourActionTrigger",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    action: { type: Object as PropType<TourAction<VNodeChild>>, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("ActionTrigger")
    const b = useButton(() => useApi(ctx).api.pressAction(props.action))
    const el = shallowRef<Element | null>(null)
    const empty = useEmpty(el)
    return () => {
      const { api } = useApi(ctx)
      const own = normalizeProps(
        api.actionTrigger(props.action, {
          focused: b.focused.value,
          modality: b.modality.value,
          pressed: b.press.pressed.value,
          empty: empty.value,
        }),
      )
      return renderPart(
        "button",
        mergeProps(
          { ...joinHandlers(own, b.press.props, b.handlers), ref: refTo(el) },
          { ...props.action.attrs, ...attrs },
        ),
        slots.default?.() ?? props.action.label,
        props.asChild,
      )
    }
  },
})

const CloseTrigger = defineComponent({
  name: "TourCloseTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTourCtx("CloseTrigger")
    const b = useButton(() => useApi(ctx).api.pressClose())
    const el = shallowRef<Element | null>(null)
    const empty = useEmpty(el)
    return () => {
      const own = normalizeProps(
        useApi(ctx).api.closeTrigger({
          focused: b.focused.value,
          modality: b.modality.value,
          pressed: b.press.pressed.value,
          empty: empty.value,
        }),
      )
      return renderPart(
        "button",
        mergeProps({ ...joinHandlers(own, b.press.props, b.handlers), ref: refTo(el) }, attrs),
        slots.default?.(),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `tour.parts.ts` re-exports them as the `Tour` namespace. */
export {
  Actions,
  ActionTrigger,
  Arrow,
  Backdrop,
  CloseTrigger,
  Content,
  Description,
  Portal,
  Positioner,
  ProgressText,
  Root,
  Spotlight,
  Title,
  Trigger,
}
