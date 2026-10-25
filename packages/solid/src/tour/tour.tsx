/** @jsxImportSource solid-js */
// Tour: a guided tour over the page, steps that point at real elements or centred dialogs.
// `useTour` owns the machine; Root provides it (its own, or a `tour` handle) to the parts.
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
  type Accessor,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { Heading } from "../heading"
import { keepStyle } from "../keep-style"
import { LayerProvider, useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    tour: TourMessages
  }
}

/** A step with Solid content. */
export type TourStepDef = TourStep<JSX.Element>

/** What `onOpenChange` receives. */
export interface TourOpenChangeDetails {
  readonly reason: TourCloseReason | "api"
  readonly stepId: string | null
  readonly stepIndex: number
  /** True only for reason `complete`. */
  readonly complete: boolean
  cancel(): void
}

/** What `onStepChange` receives. */
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

type View = ReturnType<Service<typeof tourMachine>["view"]>

/** What `useTour` returns and `Tour.Root tour` accepts; the getters stay reactive. */
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

/**
 * The tour's API: pass it to `Tour.Root tour={…}`, or render `Tour.Root` with the props. The
 * options are an object of (possibly reactive) props, or an accessor of one.
 */
export function useTour(options: UseTourProps | Accessor<UseTourProps>): TourHandle {
  const o = (): UseTourProps => (typeof options === "function" ? options() : options)
  const root = useRootId(() => o().id)
  const parent = useParentLayer()
  const messages = useMessages("tour", tourMessages, () => o().messages)
  const env = useEnvironment(announcerCapability)
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = { ...env, position: domPositioning(env) }
  // The steps: the option, or what the mutators set since it last changed.
  const [override, setOverride] = createSignal<readonly TourStepDef[] | null>(null)
  createComputed(
    on(
      () => o().steps,
      () => setOverride(null),
      { defer: true },
    ),
  )
  const steps = () => override() ?? o().steps
  let service: Service<typeof tourMachine> | null = null
  const read = () => {
    const view = service?.view()
    return {
      shown: (view?.values.stepId as string | undefined) || null,
      context: service?.getSnapshot().context as TourContext | undefined,
    }
  }
  const props = createMemo((): TourProps => {
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
      messages: messages(),
      // Not `defaultStepId`: the first shown step of every run is reported to onStepChange.
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
  })
  const machine = useMachine(tourMachine, props, withPosition)
  service = machine.service
  const { view, send } = machine
  const shown = () => (view().values.stepId as string) || null
  return {
    service: machine.service,
    get root() {
      return root()
    },
    get props() {
      return props()
    },
    get messages() {
      return messages()
    },
    get open() {
      return view().values.open as boolean
    },
    get stepId() {
      return view().matches("idle") ? null : shown()
    },
    get stepIndex() {
      return view().matches("idle") ? -1 : tourStepIndex(steps(), shown())
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
    setSteps: (list) => setOverride(list),
    addStep: (step, index) => {
      const list = [...untrack(steps)]
      list.splice(index ?? list.length, 0, step)
      setOverride(list)
    },
    removeStep: (rid) => setOverride(untrack(steps).filter((x) => x.id !== rid)),
    updateStep: (uid, patch) =>
      setOverride(untrack(steps).map((x) => (x.id === uid ? { ...x, ...patch, id: x.id } : x))),
  }
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

interface Ctx {
  readonly tour: TourHandle
  /** The machine's view, followed reactively (the handle's service notifies on change). */
  readonly view: Accessor<View>
  readonly contentMounted: Accessor<boolean>
  readonly setContentMounted: (on: boolean) => void
  readonly titleLevel: Accessor<HeadingLevel>
  readonly setTitleLevel: (level: HeadingLevel) => void
  readonly rendered: Accessor<Rendered>
  readonly setRendered: (update: (r: Rendered) => Rendered) => void
  readonly meta: Accessor<LayerMeta | undefined>
}

const TourCtx = createContext<Ctx>()
function useTourCtx(part: string): Ctx {
  const ctx = useContext(TourCtx)
  if (!ctx) throw new Error(`Tour.${part} must be inside Tour.Root`)
  return ctx
}

interface Extra {
  dir?: "ltr" | "rtl" | undefined
  focusWithin?: boolean | undefined
  contentFocused?: boolean | undefined
  modality?: Parameters<typeof tourConnect>[0]["modality"] | undefined
}

/** The tour's connect and the shown step (read in a computation). */
function useApi(ctx: Ctx, extra: Accessor<Extra> = () => ({})) {
  return createMemo(() => {
    const { tour } = ctx
    const view = ctx.view()
    const state = view.state as TourMachineState
    const context = view.context as TourContext
    const tourProps = tour.props
    const step = resolveStep(tourProps, context.patches, view.values.stepId as string) as
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
          steps: tourProps.steps,
          step,
          targetMissing: context.targetMissing,
          modal: !!step && isStepModal(tourProps, step, centered),
          placement: context.placement,
          closeReason: context.closeReason,
          shownOnce: context.shownOnce,
          stepChanging: context.stepChanging,
          preventTargetInteraction: tourProps.preventTargetInteraction === true,
          rendered: ctx.rendered(),
          contentMounted: ctx.contentMounted(),
          meta: ctx.meta(),
          ...extra(),
          messages: tour.messages,
        } as Parameters<typeof tourConnect>[0],
        tour.service.send,
      ),
    }
  })
}

/** Provides a handle to the parts below. */
function Provider(props: { readonly tour: TourHandle; readonly children?: JSX.Element }) {
  const env = useEnvironment()
  const { tour } = props
  const [view, setView] = createSignal(tour.service.view())
  afterMount(() => {
    setView(tour.service.view())
    onCleanup(tour.service.subscribe(() => setView(tour.service.view())))
  })
  const [contentMounted, setContentMounted] = createSignal(false)
  const [titleLevel, setTitleLevel] = createSignal<HeadingLevel>(2)
  const [rendered, setRendered] = createSignal<Rendered>({})
  const [meta, setMeta] = createSignal<LayerMeta | undefined>(undefined)
  // The stack's metadata for this tour's layer, followed while a step is shown.
  afterMount(() => {
    const active = createMemo(() => view().state === "active")
    createEffect(() => {
      setMeta(undefined)
      if (!active()) return
      const node = env.dom.getRootNode()
      const stack = getLayerStack("body" in node ? node : node.ownerDocument)
      const read = () => setMeta(stack.get(tourLayerId(tour.root))?.meta())
      read()
      onCleanup(stack.subscribe(read))
    })
  })
  const ctx: Ctx = {
    tour,
    view,
    contentMounted,
    setContentMounted,
    titleLevel,
    setTitleLevel,
    rendered,
    setRendered,
    meta,
  }
  return <TourCtx.Provider value={ctx}>{props.children}</TourCtx.Provider>
}

function OwnRoot(props: UseTourProps & { readonly children?: JSX.Element }) {
  const [local, rest] = splitProps(props, ["children"])
  const tour = useTour(() => rest as UseTourProps)
  return <Provider tour={tour}>{local.children}</Provider>
}

export type TourRootProps = (
  | ({ readonly tour: TourHandle } & { readonly [K in keyof UseTourProps]?: never })
  | (UseTourProps & { readonly tour?: never })
) & {
  /** The tour's parts. */
  readonly children?: JSX.Element
}

/** The tour's provider: given a `tour` handle (`useTour`), or the tour's own props. */
function Root(props: TourRootProps) {
  // Decided once, as a component's choice between its two forms.
  const tour = untrack(() => props.tour)
  if (tour) return <Provider tour={tour}>{props.children}</Provider>
  // Sound: without `tour`, the props are UseTourProps (the union's other branch).
  return <OwnRoot {...(props as UseTourProps & { children?: JSX.Element })} />
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

/** Focus and modality of a button part, plus its press. */
function useButton(onPress: (modality: Modality) => void) {
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the button is mounted.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
  })
  return {
    focused,
    modality,
    press,
    handlers: { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
  }
}

/** Whether the element renders no content of its own (an icon-only button). */
function useEmpty(el: Accessor<Element | null>) {
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
  return empty
}

export interface TourTriggerState {
  readonly open: boolean
}

function Trigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>, TourTriggerState>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("Trigger")
  const api = useApi(ctx)
  const b = useButton((m) => untrack(api).api.pressTrigger(m))
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = useRenderedTag(
    () => "button",
    () => local.render,
    el,
  )
  const state = reactive<TourTriggerState>(() => ({ open: api().api.open }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().api.trigger({
              focused: b.focused(),
              modality: b.modality(),
              pressed: b.press.pressed(),
              tag: tag(),
            }),
          ),
          b.press.props,
          b.handlers,
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** The Portal with the trigger as its logical parent: the host carries its theme, dir and lang. */
function Portal(props: PortalProps) {
  const ctx = useTourCtx("Portal")
  const env = useEnvironment()
  const logicalParent = () => env.dom.getById(tourIds(ctx.tour.root).trigger)
  return <PortalPart logicalParent={logicalParent} {...props} />
}

function Backdrop(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("Backdrop")
  const api = useApi(ctx)
  // Mounted after hydration only: a `defaultOpen` tour renders nothing on the server.
  const [hydrated, setHydrated] = createSignal(false)
  afterMount(() => setHydrated(true))
  const [node, setNode] = createSignal<Element | null>(null)
  // The tour's whole run: the same node between steps (no flash).
  const presence = usePresence(() => api().api.open, node)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(api().api.backdrop()), ref: setNode }, rest),
  )
  const children = () => local.children
  return (
    <Show when={presence.mounted() && hydrated()}>
      {untrack(() =>
        renderPart(local.render, merged, undefined, children, (p) => (
          <div {...p}>{children()}</div>
        )),
      )}
    </Show>
  )
}

function Spotlight(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("Spotlight")
  const api = useApi(ctx)
  const [node, setNode] = createSignal<Element | null>(null)
  const open = createMemo(() => api().state === "active" && !api().api.centered)
  const presence = usePresence(open, node)
  const changing = createMemo(() => (ctx.view().context as TourContext).stepChanging)
  // The step change ends with the spotlight's own transition, or with the first scroll or
  // resize once nothing animates any more (the step's own scrollIntoView does not end it).
  afterMount(() => {
    createEffect(() => {
      const el = node()
      if (!changing() || !presence.mounted() || !el) return
      const settle = () => ctx.tour.service.send({ type: "SPOTLIGHT.SETTLED" })
      const view = el.ownerDocument.defaultView
      const onTransition = (e: Event) => {
        if (e.target === el) settle()
      }
      const onMove = () => {
        if (!el.getAnimations?.().length) settle()
      }
      el.addEventListener("transitionend", onTransition)
      el.addEventListener("transitioncancel", onTransition)
      view?.addEventListener("scroll", onMove, { capture: true, passive: true })
      view?.addEventListener("resize", onMove)
      onCleanup(() => {
        el.removeEventListener("transitionend", onTransition)
        el.removeEventListener("transitioncancel", onTransition)
        view?.removeEventListener("scroll", onMove, { capture: true })
        view?.removeEventListener("resize", onMove)
      })
    })
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(api().api.spotlight()), ref: setNode }, rest),
  )
  const children = () => local.children
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, merged, undefined, children, (p) => (
          <div {...p}>{children()}</div>
        )),
      )}
    </Show>
  )
}

/** The target's direction: the portalled positioner carries it (inline sides, RTL). */
function useTargetDir(ctx: Ctx, step: Accessor<TourStepDef | undefined>, shown: Accessor<boolean>) {
  const [dir, setDir] = createSignal<"ltr" | "rtl" | undefined>(undefined)
  const env = useEnvironment()
  afterMount(() => {
    createEffect(() => {
      if (!shown()) return
      const anchor = step()?.target?.() ?? env.dom.getById(tourIds(ctx.tour.root).trigger)
      const found = anchor?.closest("[dir]")?.getAttribute("dir")
      setDir(found === "rtl" ? "rtl" : "ltr")
    })
  })
  return dir
}

function Positioner(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("Positioner")
  const base = useApi(ctx)
  // A memo: the effects below must not follow every connect change.
  const shown = createMemo(() => base().state === "active")
  const dir = useTargetDir(ctx, () => base().step, shown)
  const api = useApi(ctx, () => (dir() ? { dir: dir() } : {}))
  const [node, setNode] = createSignal<Element | null>(null)
  // It holds the content: it stays while the content's exit animations run.
  const presence = usePresence(shown, node, { subtree: () => true })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(api().api.positioner()), ref: setNode }, rest),
  )
  // Positioning writes this element's style too.
  const kept = keepStyle(merged)
  const children = () => local.children
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

export interface TourContentState {
  readonly open: boolean
  readonly stepId: string | null
}

function Content(props: Own<JSX.HTMLAttributes<HTMLDivElement>, TourContentState>) {
  const [local, rest] = splitProps(props, [
    "render",
    "children",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
  ])
  const ctx = useTourCtx("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = createSignal(false)
  const [contentFocused, setContentFocused] = createSignal(false)
  const modality = useModality(env.modality, contentFocused)
  const api = useApi(ctx, () => ({
    focusWithin: focusWithin(),
    contentFocused: contentFocused(),
    modality: modality(),
  }))
  // Not from `api`: the effect below writes what `api` reads (contentMounted).
  const shown = createMemo(() => ctx.view().state === "active")
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(shown, node)
  afterMount(() => {
    createEffect(() => {
      const el = presence.mounted() ? node() : null
      ctx.setContentMounted(el !== null)
      if (!(el instanceof HTMLElement)) return
      onCleanup(() => ctx.setContentMounted(false))
      // Focus within, from the DOM itself (native events plus a frame check).
      const sync = () => {
        const active = el.ownerDocument.activeElement
        setFocusWithin(active !== null && el.contains(active))
        setContentFocused(active === el)
      }
      const onFocusOut = (e: FocusEvent) => {
        const next = e.relatedTarget as Node | null
        if (next && el.contains(next)) return
        setFocusWithin(false)
        setContentFocused(false)
      }
      sync()
      const frame = env.scheduler.requestAnimationFrame(sync)
      el.addEventListener("focusin", sync)
      el.addEventListener("focusout", onFocusOut)
      onCleanup(() => {
        env.scheduler.cancelAnimationFrame(frame)
        el.removeEventListener("focusin", sync)
        el.removeEventListener("focusout", onFocusOut)
      })
    })
  })
  // Once closing, the card is inert.
  const exiting = () => !shown() && presence.state() === "exiting"
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          api().api.content({
            label: local["aria-label"],
            labelledBy: local["aria-labelledby"],
            describedBy: local["aria-describedby"],
          }),
        ),
        ...(exiting() ? { inert: true } : {}),
        ref: setNode,
      },
      rest,
    ),
  )
  const state = reactive<TourContentState>(() => ({
    open: shown(),
    stepId: api().step?.id ?? null,
  }))
  // The scroll lock writes this element's style too.
  const kept = keepStyle(merged)
  // Headings inside the card are one level below the title; layers opened from here are the
  // tour's children.
  const children = () => (
    <LayerProvider layer={tourLayerId(ctx.tour.root)} kind="tour">
      <Heading.Level level={Math.min(6, ctx.titleLevel() + 1) as HeadingLevel}>
        {local.children}
      </Heading.Level>
    </LayerProvider>
  )
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, state, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

function Arrow(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("Arrow")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().api.arrow()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Registers a title/description part with the Root while it is mounted. */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  afterMount(() => {
    createEffect(() => {
      const id = partId("tour", ctx.tour.root, part)
      ctx.setRendered((r) => ({ ...r, [part]: id }))
      onCleanup(() => ctx.setRendered((r) => ({ ...r, [part]: undefined })))
    })
  })
}

export type TourTitleProps = Own<JSX.HTMLAttributes<HTMLHeadingElement>> & {
  /** The heading level (default 2); headings in the card are one level below. */
  readonly level?: HeadingLevel | undefined
}

/** The step's title: its children, or the shown step's `title`. */
function Title(props: TourTitleProps) {
  const [local, rest] = splitProps(props, ["level", "render", "children"])
  const ctx = useTourCtx("Title")
  const api = useApi(ctx)
  useRegistered(ctx, "title")
  const level = () => local.level ?? 2
  createEffect(() => ctx.setTitleLevel(level()))
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = useRenderedTag(
    () => `h${level()}`,
    () => local.render,
    el,
  )
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().api.title({ level: level(), tag: tag() })), ref: setEl },
      rest,
    ),
  )
  const children = () => local.children ?? api().step?.title
  return renderPart(local.render, merged, undefined, children, (p) => (
    <Dynamic component={`h${level()}`} {...p}>
      {children()}
    </Dynamic>
  ))
}

/** The step's description: its children, or the shown step's `description`. */
function Description(props: Own<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("Description")
  const api = useApi(ctx)
  useRegistered(ctx, "description")
  const merged = createMemo(() => mergeProps(normalizeProps(api().api.description()), rest))
  const children = () => local.children ?? api().step?.description
  return renderPart(local.render, merged, undefined, children, (p) => <p {...p}>{children()}</p>)
}

function ProgressText(props: Own<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("ProgressText")
  const api = useApi(ctx)
  const merged = createMemo(() => mergeProps(normalizeProps(api().api.progressText()), rest))
  const children = () => local.children ?? api().api.progressLabel()
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

const sameActions = (
  a: readonly TourAction<JSX.Element>[],
  b: readonly TourAction<JSX.Element>[],
) => a.length === b.length && a.every((x, i) => x === b[i])

/** Calls its children with the shown step's actions. */
function Actions(props: {
  /** Renders the shown step's actions. */
  readonly children: (actions: readonly TourAction<JSX.Element>[]) => JSX.Element
}) {
  const ctx = useTourCtx("Actions")
  const api = useApi(ctx)
  // Kept while the actions are the same objects: the buttons are not rebuilt on every change.
  // Sound: the steps are TourStepDef, whose actions carry Solid labels.
  const actions = createMemo(
    () => api().api.actions as readonly TourAction<JSX.Element>[],
    undefined,
    {
      equals: sameActions,
    },
  )
  return <>{props.children(actions())}</>
}

export type TourActionTriggerProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>> & {
  readonly action: TourAction<JSX.Element>
}

function ActionTrigger(props: TourActionTriggerProps) {
  const [local, rest] = splitProps(props, ["action", "render", "children"])
  const ctx = useTourCtx("ActionTrigger")
  const api = useApi(ctx)
  const b = useButton(() => untrack(api).api.pressAction(local.action))
  const [el, setEl] = createSignal<Element | null>(null)
  const empty = useEmpty(el)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().api.actionTrigger(local.action, {
              focused: b.focused(),
              modality: b.modality(),
              pressed: b.press.pressed(),
              empty: empty(),
            }),
          ),
          b.press.props,
          b.handlers,
        ),
        ref: setEl,
      },
      { ...local.action.attrs },
      rest,
    ),
  )
  const children = () => local.children ?? local.action.label
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function CloseTrigger(props: Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useTourCtx("CloseTrigger")
  const api = useApi(ctx)
  const b = useButton(() => untrack(api).api.pressClose())
  const [el, setEl] = createSignal<Element | null>(null)
  const empty = useEmpty(el)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().api.closeTrigger({
              focused: b.focused(),
              modality: b.modality(),
              pressed: b.press.pressed(),
              empty: empty(),
            }),
          ),
          b.press.props,
          b.handlers,
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

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
