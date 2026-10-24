/** @jsxImportSource solid-js */
import {
  adjacentStep,
  announcerCapability,
  type ChangeDetails,
  focusSafely,
  type MessageOverrides,
  partId,
  type StepperChangeDetails,
  type StepperChangeReason,
  type StepperEvent,
  type StepperMessages,
  type StepperOrientation,
  stepperConnect,
  stepperMachine,
  stepperMessages,
  stepReachable,
  stepStatus,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    stepper: StepperMessages
  }
}

/** What every part's `render` receives. */
export interface StepperRenderState {
  readonly step: number
  readonly count: number
  readonly orientation: StepperOrientation
}

type Api = ReturnType<typeof stepperConnect>

interface Registry {
  disabled(index: number, on: boolean): () => void
  completed(index: number, value: boolean | undefined): () => void
  title(index: number, text: string): () => void
}

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: StepperRenderState
  readonly send: (event: StepperEvent) => void
  readonly registry: Registry
  readonly messages: Accessor<StepperMessages>
}
const StepperContext = createContext<Ctx>()
function useStepper(part: string): Ctx {
  const ctx = useContext(StepperContext)
  if (!ctx) throw new Error(`Stepper.${part} must be inside Stepper.Root`)
  return ctx
}
interface ItemCtx {
  readonly index: Accessor<number>
  /** A Description is rendered: the Trigger is described by it. */
  readonly described: Accessor<boolean>
  readonly setDescribed: (on: boolean) => void
}
const ItemContext = createContext<ItemCtx>()
function useItem(part: string): ItemCtx {
  const item = useContext(ItemContext)
  if (!item) throw new Error(`Stepper.${part} must be inside Stepper.Item`)
  return item
}

/** A focusable part's own focus, tracked from mount so the focusing press is already known. */
function useFocusState() {
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return {
    focus: () => ({ focused: focused(), modality: modality() }),
    handlers: {
      onFocusIn: (e: FocusEvent) => {
        if (e.target === e.currentTarget) setFocused(true)
      },
      onFocusOut: (e: FocusEvent) => {
        if (e.target === e.currentTarget) setFocused(false)
      },
    },
  }
}

/** A map state with stable, per-key register / unregister. */
function useRegistryState<V>() {
  const [map, setMap] = createSignal<ReadonlyMap<number, V>>(new Map())
  const put = (index: number, value: V | undefined) => {
    setMap((m) => {
      if (value === undefined ? !m.has(index) : m.get(index) === value) return m
      const next = new Map(m)
      if (value === undefined) next.delete(index)
      else next.set(index, value)
      return next
    })
    return () =>
      setMap((m) => {
        if (!m.has(index)) return m
        const next = new Map(m)
        next.delete(index)
        return next
      })
  }
  return [map, put] as const
}

export type StepperRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly children?: JSX.Element | ((state: StepperRenderState) => JSX.Element)
  /** How many steps. */
  readonly count: number
  /** Controlled current step (0-based). */
  readonly step?: number | undefined
  readonly defaultStep?: number | undefined
  /** `details.reason`: "next", "prev" or "select"; `details.cancel()` refuses it. */
  readonly onStepChange?: ((step: number, details: StepperChangeDetails) => void) | undefined
  /** Back to any visited step; forward only with NextTrigger (default true). */
  readonly linear?: boolean | undefined
  readonly orientation?: StepperOrientation | undefined
  readonly messages?: MessageOverrides<StepperMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  readonly render?: RenderProp<StepperRenderState> | undefined
}

function Root(props: StepperRootProps) {
  const [own, rest] = splitProps(props, [
    "count",
    "step",
    "defaultStep",
    "onStepChange",
    "linear",
    "orientation",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => rest.id)
  const locale = useLocale(() => own.locale)
  const messages = useMessages("stepper", stepperMessages, () => own.messages)
  const [disabledMap, putDisabled] = useRegistryState<true>()
  const [completedMap, putCompleted] = useRegistryState<boolean>()
  const [titleMap, putTitle] = useRegistryState<string>()
  const contentId = (i: number) => partId("stepper", instance(), `content-${i}`)
  const machineEnv = {
    ...env,
    focusContent: (index: number) => {
      // The press's modality, read now: the focus lands a frame later (after the commit that
      // shows the step), when the tracker no longer knows what caused it.
      const modality = env.modality.modality()
      env.scheduler.requestAnimationFrame(() => {
        const el = document.getElementById(contentId(index))
        if (el) void focusSafely(el, env, "programmatic", modality)
      })
    },
  }
  const disabledSteps = createMemo(() => new Set(disabledMap().keys()))
  const machineProps = () => ({
    id: instance(),
    count: own.count,
    step: own.step,
    defaultStep: own.defaultStep,
    ...(own.onStepChange
      ? {
          onStepChange: (next: number, d: ChangeDetails<StepperEvent>) =>
            // Sound: every step-writing transition declares one of these reasons (machine).
            own.onStepChange?.(next, {
              ...d,
              reason: d.reason as unknown as StepperChangeReason,
              cancel: d.cancel,
            }),
        }
      : {}),
    linear: own.linear,
    disabledSteps: disabledSteps(),
    completedSteps: completedMap(),
    titles: titleMap(),
    messages: messages(),
    lang: locale().locale,
  })
  const { view, send } = useMachine(stepperMachine, machineProps, machineEnv)
  const api = createMemo(() => {
    const mp = machineProps()
    const current = view().values.step
    const titles = mp.titles
    return stepperConnect({
      instance: mp.id,
      step: current,
      count: mp.count,
      orientation: own.orientation ?? "horizontal",
      status: (i) => stepStatus(mp, current, i),
      reachable: (i) => stepReachable(mp, view().context, current, i),
      disabled: (i) => mp.disabledSteps.has(i),
      title: (i) => titles.get(i) ?? "",
      hasNext: adjacentStep(mp, current, 1) !== null,
      hasPrev: adjacentStep(mp, current, -1) !== null,
      ids: {
        content: contentId,
        description: (i) => partId("stepper", mp.id, `description-${i}`),
      },
      messages: mp.messages,
      locale: mp.lang,
    })
  })
  const registry: Registry = {
    disabled: (index, on) => putDisabled(index, on ? true : undefined),
    completed: (index, value) => putCompleted(index, value),
    title: (index, text) => putTitle(index, text || undefined),
  }
  const state = reactive<StepperRenderState>(() => ({
    step: view().values.step,
    count: own.count,
    orientation: own.orientation ?? "horizontal",
  }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <StepperContext.Provider value={{ api, state, send, registry, messages }}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </StepperContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<StepperRenderState> | undefined
  readonly children?: JSX.Element | ((state: StepperRenderState) => JSX.Element)
}

export type StepperListProps = PartProps<JSX.OlHTMLAttributes<HTMLOListElement>>

function List(props: StepperListProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("List")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().list()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => <ol {...p}>{children()}</ol>)
}

export type StepperItemProps = PartProps<JSX.LiHTMLAttributes<HTMLLIElement>> & {
  /** The step's index (0-based). */
  readonly index: number
  /** The step cannot be visited; Next and Previous skip it. */
  readonly disabled?: boolean | undefined
  /** Overrides the status: completed (true) or not (false) whatever the current step. */
  readonly completed?: boolean | undefined
}

function Item(props: StepperItemProps) {
  const [local, rest] = splitProps(props, ["render", "index", "disabled", "completed", "children"])
  const ctx = useStepper("Item")
  const { registry } = ctx
  createEffect(() => onCleanup(registry.disabled(local.index, local.disabled === true)))
  createEffect(() => onCleanup(registry.completed(local.index, local.completed)))
  const [described, setDescribed] = createSignal(false)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().item(local.index)), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <ItemContext.Provider value={{ index: () => local.index, described, setDescribed }}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </ItemContext.Provider>
  )
}

export type StepperTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function Trigger(props: StepperTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("Trigger")
  const item = useItem("Trigger")
  const { focus, handlers } = useFocusState()
  const button = () => ctx.api().triggerIsButton(item.index())
  const content = () => (
    <>
      {resolveChildren(local.children, ctx.state)}
      <span {...normalizeProps(ctx.api().statusProps())}>{ctx.api().statusText(item.index())}</span>
    </>
  )
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().trigger(item.index(), item.described(), focus())), {
        ...handlers,
        ...(button() ? { onClick: () => ctx.send({ type: "SELECT", index: item.index() }) } : {}),
      }),
      rest,
    ),
  )
  // A step the user cannot reach is text, not a disabled button (no dead tab stop).
  return renderPart(local.render, merged, ctx.state, content, (p) => (
    <Show when={button()} fallback={<span {...p}>{content()}</span>}>
      <button {...p}>{content()}</button>
    </Show>
  ))
}

export type StepperIndicatorProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Indicator(props: StepperIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("Indicator")
  const item = useItem("Indicator")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().indicator(item.index())), rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Title(props: StepperIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("Title")
  const item = useItem("Title")
  const [el, setEl] = createSignal<Element | null>(null)
  const { registry } = ctx
  // The title's text names the announcement and the content region. It follows the text
  // (observed), and is unregistered once, with the part or when its index changes.
  afterMount(() => {
    createEffect(() => {
      const node = el()
      const index = item.index()
      if (!node) return
      const update = () => registry.title(index, node.textContent?.trim() ?? "")
      update()
      const observer = new MutationObserver(update)
      observer.observe(node, { childList: true, characterData: true, subtree: true })
      onCleanup(() => {
        observer.disconnect()
        registry.title(index, "")
      })
    })
  })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().title(item.index())), rest, { ref: setEl }),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Description(props: StepperIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("Description")
  const item = useItem("Description")
  createEffect(() => {
    item.setDescribed(true)
    onCleanup(() => item.setDescribed(false))
  })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().description(item.index())), rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type StepperSeparatorProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Separator(props: StepperSeparatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("Separator")
  const item = useItem("Separator")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().separator(item.index())), rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type StepperContentProps = StepperSeparatorProps & {
  /** The step this content belongs to (0-based). */
  readonly index: number
}

function Content(props: StepperContentProps) {
  const [local, rest] = splitProps(props, ["render", "index", "children"])
  const ctx = useStepper("Content")
  const { focus, handlers } = useFocusState()
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().content(local.index, focus())), handlers),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function PrevTrigger(props: StepperTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("PrevTrigger")
  const { focus, handlers } = useFocusState()
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().prevTrigger(focus())), {
        ...handlers,
        onClick: () => ctx.send({ type: "PREV" }),
      }),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.messages().prevLabel
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function NextTrigger(props: StepperTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("NextTrigger")
  const { focus, handlers } = useFocusState()
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().nextTrigger(focus())), {
        ...handlers,
        onClick: () => ctx.send({ type: "NEXT" }),
      }),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.messages().nextLabel
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function Progress(props: StepperIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStepper("Progress")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().progress()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().progressText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `stepper.parts.ts` re-exports them as the `Stepper` namespace. */
export {
  Content,
  Description,
  Indicator,
  Item,
  List,
  NextTrigger,
  PrevTrigger,
  Progress,
  Root,
  Separator,
  Title,
  Trigger,
}
