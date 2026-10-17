import {
  domPositioning,
  getLayerStack,
  type HeadingLevel,
  isAnchoredTourStep,
  isStepModal,
  type LayerMeta,
  type MessageOverrides,
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
  type ComponentPropsWithRef,
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Heading } from "../heading/heading"
import { joinHandlers } from "../join-handlers"
import { LayerProvider, useParentLayer } from "../layer-context"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    tour: TourMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** A step with React content. */
export type TourStepDef = TourStep<ReactNode>

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
  readonly id?: string
  readonly steps: readonly TourStepDef[]
  readonly stepId?: string | null | undefined
  readonly onOpenChange?: ((open: boolean, details: TourOpenChangeDetails) => void) | undefined
  readonly onStepChange?: ((stepId: string, details: TourStepChangeDetails) => void) | undefined
  readonly messages?: MessageOverrides<TourMessages>
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

/** What `useTour` returns and `Tour.Root tour` accepts. */
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

/** The tour's API: pass it to `Tour.Root tour={…}`, or render `Tour.Root` with the props. */
export function useTour({
  id,
  steps: ownSteps,
  messages: ownMessages,
  onOpenChange,
  onStepChange,
  stepId,
  defaultStepId,
  ...rest
}: UseTourProps): TourHandle {
  const root = useRootId(id)
  const parent = useParentLayer()
  const messages = useMessages("tour", tourMessages, ownMessages)
  const env = useEnvironment()
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = useMemo(() => ({ ...env, position: domPositioning(env) }), [env])
  // The steps: the prop, or what the mutators set since it last changed.
  const [override, setOverride] = useState<readonly TourStepDef[] | null>(null)
  const lastProp = useRef(ownSteps)
  if (lastProp.current !== ownSteps) {
    lastProp.current = ownSteps
    if (override) setOverride(null)
  }
  const steps = override ?? ownSteps
  const serviceRef = useRef<Service<typeof tourMachine> | null>(null)
  const read = () => {
    const s = serviceRef.current
    const view = s?.view()
    return {
      shown: (view?.values.stepId as string | undefined) || null,
      context: s?.getSnapshot().context as TourContext | undefined,
    }
  }
  const props: TourProps = {
    ...rest,
    root,
    parent,
    steps,
    messages,
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
            stepIndex: tourStepIndex(steps, shown),
            complete: reason === "complete",
            cancel: d.cancel,
          })
        }
      : undefined,
    onStepIdChange: onStepChange
      ? (next, d) => {
          const { shown, context } = read()
          const p = tourProgress(steps, next)
          const direction = context?.direction ?? "forward"
          onStepChange(next, {
            stepIndex: tourStepIndex(steps, next),
            totalSteps: p.total,
            progress: p.progress,
            direction,
            reason: reasonOf(direction, shown === null),
            cancel: d.cancel,
          })
        }
      : undefined,
  }
  const { service, view, send } = useMachine(tourMachine, props, withPosition)
  serviceRef.current = service
  const shown = (view.values.stepId as string) || null
  const stepsRef = useRef(ownSteps)
  stepsRef.current = ownSteps
  // Stable across renders: effects may list them as dependencies.
  const methods = useMemo(
    () => ({
      start: (o?: { readonly stepId?: string }) => send({ type: "START", stepId: o?.stepId }),
      stop: () => send({ type: "api" }),
      next: () => send({ type: "STEP.NEXT" }),
      prev: () => send({ type: "STEP.PREV" }),
      goto: (to: string) => send({ type: "STEP.GOTO", id: to }),
      reposition: () => send({ type: "POSITION.REPOSITION" }),
      setSteps: (list: readonly TourStepDef[]) => setOverride(list),
      addStep: (step: TourStepDef, index?: number) =>
        setOverride((cur) => {
          const list = [...(cur ?? stepsRef.current)]
          list.splice(index ?? list.length, 0, step)
          return list
        }),
      removeStep: (rid: string) =>
        setOverride((cur) => (cur ?? stepsRef.current).filter((x) => x.id !== rid)),
      updateStep: (uid: string, patch: Partial<Omit<TourStepDef, "id">>) =>
        setOverride((cur) =>
          (cur ?? stepsRef.current).map((x) => (x.id === uid ? { ...x, ...patch, id: x.id } : x)),
        ),
    }),
    [send],
  )
  return {
    service,
    root,
    props,
    messages,
    open: view.values.open as boolean,
    stepId: view.matches("idle") ? null : shown,
    stepIndex: view.matches("idle") ? -1 : tourStepIndex(steps, shown),
    steps,
    ...methods,
  }
}

interface Ctx {
  readonly tour: TourHandle
  readonly contentMounted: boolean
  readonly setContentMounted: (on: boolean) => void
  readonly titleLevel: HeadingLevel
  readonly setTitleLevel: (level: HeadingLevel) => void
  readonly rendered: Rendered
  readonly setRendered: Dispatch<SetStateAction<Rendered>>
}

const TourCtx = createContext<Ctx | null>(null)
function useTourCtx(part: string): Ctx {
  const ctx = useContext(TourCtx)
  if (!ctx) throw new Error(`Tour.${part} must be inside Tour.Root`)
  return ctx
}

/** The stack's metadata for this tour's layer, followed while a step is shown. */
function useMeta(root: string, shown: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!shown || typeof document === "undefined") return setMeta(undefined)
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => setMeta(stack.get(tourLayerId(root))?.meta())
    read()
    return stack.subscribe(read)
  }, [root, env, shown])
  return meta
}

function useApi(
  ctx: Ctx,
  extra: {
    dir?: "ltr" | "rtl"
    focusWithin?: boolean
    contentFocused?: boolean
    modality?: Parameters<typeof tourConnect>[0]["modality"]
  } = {},
) {
  const { tour } = ctx
  const view = useSelector(tour.service, (v) => v)
  const state = view.state as TourMachineState
  const context = view.context as TourContext
  const step = resolveStep(tour.props, context.patches, view.values.stepId as string) as
    | TourStepDef
    | undefined
  const centered = !step || context.targetMissing || !isAnchoredTourStep(step)
  const meta = useMeta(tour.root, state === "active")
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
        preventTargetInteraction: tour.props.preventTargetInteraction === true,
        rendered: ctx.rendered,
        contentMounted: ctx.contentMounted,
        meta,
        ...extra,
        messages: tour.messages,
      },
      tour.service.send,
    ),
  }
}

export type TourRootProps = (
  | ({ readonly tour: TourHandle } & { readonly [K in keyof UseTourProps]?: never })
  | (UseTourProps & { readonly tour?: never })
) & { readonly children?: ReactNode }

function Provider({ tour, children }: { tour: TourHandle; children?: ReactNode }) {
  const [contentMounted, setContentMounted] = useState(false)
  const [titleLevel, setTitleLevel] = useState<HeadingLevel>(2)
  const [rendered, setRendered] = useState<Rendered>({})
  const ctx: Ctx = {
    tour,
    contentMounted,
    setContentMounted,
    titleLevel,
    setTitleLevel,
    rendered,
    setRendered,
  }
  return <TourCtx value={ctx}>{children}</TourCtx>
}

function OwnRoot({ children, ...props }: UseTourProps & { children?: ReactNode }) {
  const tour = useTour(props)
  return <Provider tour={tour}>{children}</Provider>
}

function Root(props: TourRootProps) {
  if (props.tour) return <Provider tour={props.tour}>{props.children}</Provider>
  // Sound: without `tour`, the props are UseTourProps (the union's other branch).
  return <OwnRoot {...(props as UseTourProps & { children?: ReactNode })} />
}

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

export interface TourTriggerState {
  readonly open: boolean
}

function Trigger({ render, ref, ...rest }: Own<"button", TourTriggerState>) {
  const ctx = useTourCtx("Trigger")
  const { api } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") api.pressTrigger(e.modality)
    },
  })
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const own = normalizeProps(api.trigger({ focused, modality, pressed: press.pressed, tag }))
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, { open: api.open })
}

function Portal(props: PortalProps) {
  const ctx = useTourCtx("Portal")
  const env = useEnvironment()
  // The host carries the trigger's theme, dir and lang.
  const logicalParent = () => env.dom.getById(tourIds(ctx.tour.root).trigger)
  return <PortalPart logicalParent={logicalParent} {...props} />
}

/** Mounted after hydration only: a `defaultOpen` tour renders nothing on the server. */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useIsoLayoutEffect(() => setHydrated(true), [])
  return hydrated
}

function Backdrop({ render, ref, ...rest }: Own<"div">) {
  const ctx = useTourCtx("Backdrop")
  const { api } = useApi(ctx)
  const hydrated = useHydrated()
  const node = useRef<HTMLElement | null>(null)
  // The tour's whole run: the same node between steps (no flash).
  const { mounted } = usePresence(api.open, node)
  if (!mounted || !hydrated) return null
  const props = mergeProps({ ...normalizeProps(api.backdrop()), ref: composeRefs(node, ref) }, rest)
  return renderPart("div", props, render, undefined)
}

function Spotlight({ render, ref, ...rest }: Own<"div">) {
  const ctx = useTourCtx("Spotlight")
  const { api, state } = useApi(ctx)
  const node = useRef<HTMLElement | null>(null)
  const { mounted } = usePresence(state === "active" && !api.centered, node)
  if (!mounted) return null
  const props = mergeProps(
    { ...normalizeProps(api.spotlight()), ref: composeRefs(node, ref) },
    rest,
  )
  return renderPart("div", props, render, undefined)
}

/** The target's direction: the portalled positioner carries it (inline sides, RTL). */
function useTargetDir(ctx: Ctx, step: TourStepDef | undefined, shown: boolean) {
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  useIsoLayoutEffect(() => {
    if (!shown) return
    const anchor = step?.target?.() ?? document.getElementById(tourIds(ctx.tour.root).trigger)
    const found = anchor?.closest("[dir]")?.getAttribute("dir")
    setDir(found === "rtl" ? "rtl" : "ltr")
  }, [shown, step, ctx.tour.root])
  return dir
}

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useTourCtx("Positioner")
  const base = useApi(ctx)
  const shown = base.state === "active"
  const dir = useTargetDir(ctx, base.step, shown)
  const { api } = useApi(ctx, dir ? { dir } : {})
  const node = useRef<HTMLElement | null>(null)
  // It holds the content: it stays while the content's exit animations run.
  const { mounted } = usePresence(shown, node, { subtree: true })
  if (!mounted) return null
  const props = mergeProps(
    { ...normalizeProps(api.positioner()), ref: composeRefs(node, ref) },
    { ...rest, children },
  )
  return renderPart("div", props, render, undefined)
}

export interface TourContentState {
  readonly open: boolean
  readonly stepId: string | null
}

function Content({
  render,
  ref,
  children,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  ...rest
}: Own<"div", TourContentState>) {
  const ctx = useTourCtx("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = useState(false)
  const [contentFocused, setContentFocused] = useState(false)
  const modality = useModality(env.modality, contentFocused)
  const { api, state, step } = useApi(ctx, { focusWithin, contentFocused, modality })
  const shown = state === "active"
  const node = useRef<HTMLElement | null>(null)
  const { mounted, state: presence } = usePresence(shown, node)
  const { setContentMounted } = ctx
  useIsoLayoutEffect(() => {
    if (!mounted) return
    setContentMounted(true)
    return () => setContentMounted(false)
  }, [mounted, setContentMounted])
  // Focus within, from the DOM itself (native events plus a frame check).
  useIsoLayoutEffect(() => {
    const el = node.current
    if (!mounted || !el) return
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
    return () => {
      env.scheduler.cancelAnimationFrame(frame)
      el.removeEventListener("focusin", sync)
      el.removeEventListener("focusout", onFocusOut)
    }
  }, [mounted, env, node])
  if (!mounted) return null
  const exiting = !shown && presence === "exiting"
  const props = mergeProps(
    {
      ...normalizeProps(api.content({ label, labelledBy, describedBy })),
      // Once closing, the card is inert.
      ...(exiting ? { inert: true } : {}),
      ref: composeRefs(node, ref),
    },
    {
      ...rest,
      // Headings inside the card are one level below the title; layers opened from here
      // are the tour's children.
      children: (
        <LayerProvider layer={tourLayerId(ctx.tour.root)} kind="popover">
          <Heading.Level level={Math.min(6, ctx.titleLevel + 1) as HeadingLevel}>
            {children}
          </Heading.Level>
        </LayerProvider>
      ),
    },
  )
  return renderPart("div", props, render, { open: shown, stepId: step?.id ?? null })
}

function Arrow({ render, ...rest }: Own<"div">) {
  const ctx = useTourCtx("Arrow")
  const { api } = useApi(ctx)
  return renderPart("div", mergeProps(normalizeProps(api.arrow()), rest), render, undefined)
}

/** Registers a title/description part with the Root while it is mounted (React state). */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  const { setRendered } = ctx
  const id = partId("tour", ctx.tour.root, part)
  useIsoLayoutEffect(() => {
    setRendered((r) => ({ ...r, [part]: id }))
    return () => setRendered((r) => ({ ...r, [part]: undefined }))
  }, [setRendered, part, id])
}

export type TourTitleProps = Own<"h2"> & {
  /** The heading level (default 2); headings in the card are one level below. */
  readonly level?: HeadingLevel
}

/** The step's title: its children, or the shown step's `title`. */
function Title({ level = 2, render, ref, children, ...rest }: TourTitleProps) {
  const ctx = useTourCtx("Title")
  const { api, step } = useApi(ctx)
  useRegistered(ctx, "title")
  const { setTitleLevel } = ctx
  useIsoLayoutEffect(() => setTitleLevel(level), [level, setTitleLevel])
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag(`h${level}`, render, el)
  const props = mergeProps(
    { ...normalizeProps(api.title({ level, tag })), ref: composeRefs(el, ref) },
    { ...rest, children: children ?? step?.title },
  )
  return renderPart(`h${level}`, props, render, undefined)
}

/** The step's description: its children, or the shown step's `description`. */
function Description({ render, children, ...rest }: Own<"p">) {
  const ctx = useTourCtx("Description")
  const { api, step } = useApi(ctx)
  useRegistered(ctx, "description")
  return renderPart(
    "p",
    mergeProps(normalizeProps(api.description()), {
      ...rest,
      children: children ?? step?.description,
    }),
    render,
    undefined,
  )
}

function ProgressText({ render, children, ...rest }: Own<"span">) {
  const ctx = useTourCtx("ProgressText")
  const { api } = useApi(ctx)
  return renderPart(
    "span",
    mergeProps(normalizeProps(api.progressText()), {
      ...rest,
      children: children ?? api.progressLabel(),
    }),
    render,
    undefined,
  )
}

/** Calls its children with the shown step's actions. */
function Actions({
  children,
}: {
  readonly children: (actions: readonly TourAction<ReactNode>[]) => ReactNode
}) {
  const ctx = useTourCtx("Actions")
  const { api } = useApi(ctx)
  // Sound: the steps are TourStepDef, whose actions carry React labels.
  return <>{children(api.actions as readonly TourAction<ReactNode>[])}</>
}

/** Whether the element renders no content of its own (an icon-only button). */
function useEmpty(el: { current: HTMLElement | null }) {
  const [empty, setEmpty] = useState(false)
  useIsoLayoutEffect(() => {
    setEmpty((el.current?.textContent ?? "").trim() === "")
  })
  return empty
}

export type TourActionTriggerProps = Own<"button"> & { readonly action: TourAction<ReactNode> }

function ActionTrigger({ action, render, ref, children, ...rest }: TourActionTriggerProps) {
  const ctx = useTourCtx("ActionTrigger")
  const { api } = useApi(ctx)
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  const empty = useEmpty(el)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") api.pressAction(action)
    },
  })
  const own = normalizeProps(
    api.actionTrigger(action, { focused, modality, pressed: press.pressed, empty }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    { ...action.attrs, ...rest, children: children ?? action.label },
  )
  return renderPart("button", props, render, undefined)
}

function CloseTrigger({ render, ref, ...rest }: Own<"button">) {
  const ctx = useTourCtx("CloseTrigger")
  const { api } = useApi(ctx)
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  const empty = useEmpty(el)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") api.pressClose()
    },
  })
  const own = normalizeProps(api.closeTrigger({ focused, modality, pressed: press.pressed, empty }))
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, undefined)
}

/** A guided tour over the page: steps that point at real elements, or centred dialogs. */
export const Tour = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Spotlight,
  Positioner,
  Content,
  Arrow,
  Title,
  Description,
  ProgressText,
  Actions,
  ActionTrigger,
  CloseTrigger,
}
