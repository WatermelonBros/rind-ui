"use client"

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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    stepper: StepperMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly api: Api
  readonly state: StepperRenderState
  readonly send: (event: StepperEvent) => void
  readonly registry: Registry
  readonly messages: StepperMessages
}
const StepperContext = createContext<Ctx | null>(null)
function useStepper(part: string): Ctx {
  const ctx = useContext(StepperContext)
  if (!ctx) throw new Error(`Stepper.${part} must be inside Stepper.Root`)
  return ctx
}
interface ItemCtx {
  readonly index: number
  /** A Description is rendered: the Trigger is described by it. */
  readonly described: boolean
  readonly setDescribed: (on: boolean) => void
}
const ItemContext = createContext<ItemCtx | null>(null)
function useItem(part: string): ItemCtx {
  const item = useContext(ItemContext)
  if (item === null) throw new Error(`Stepper.${part} must be inside Stepper.Item`)
  return item
}
const useItemIndex = (part: string) => useItem(part).index

/** A focusable part's own focus, tracked from mount so the focusing press is already known. */
function useFocusState() {
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return {
    focus: { focused, modality },
    handlers: {
      onFocus: (e: React.FocusEvent) => {
        if (e.target === e.currentTarget) setFocused(true)
      },
      onBlur: (e: React.FocusEvent) => {
        if (e.target === e.currentTarget) setFocused(false)
      },
    },
  }
}

/** A map state with stable, per-key register / unregister. */
function useRegistryState<V>() {
  const [map, setMap] = useState<ReadonlyMap<number, V>>(new Map())
  const put = useCallback((index: number, value: V | undefined) => {
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
  }, [])
  return [map, put] as const
}

export type StepperRootProps = ComponentPropsWithRef<"div"> & {
  /** How many steps. */
  readonly count: number
  /** Controlled current step (0-based). */
  readonly step?: number
  readonly defaultStep?: number
  /** `details.reason`: "next", "prev" or "select"; `details.cancel()` refuses it. */
  readonly onStepChange?: (step: number, details: StepperChangeDetails) => void
  /** Back to any visited step; forward only with NextTrigger (default true). */
  readonly linear?: boolean
  readonly orientation?: StepperOrientation
  readonly messages?: MessageOverrides<StepperMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly render?: RenderProp<StepperRenderState>
}

function Root({
  count,
  step,
  defaultStep,
  onStepChange,
  linear,
  orientation = "horizontal",
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: StepperRootProps) {
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("stepper", stepperMessages, ownMessages)
  const [disabledMap, putDisabled] = useRegistryState<true>()
  const [completedMap, putCompleted] = useRegistryState<boolean>()
  const [titleMap, putTitle] = useRegistryState<string>()
  const contentId = useCallback(
    (i: number) => partId("stepper", instance, `content-${i}`),
    [instance],
  )
  const [machineEnv] = useState(() => ({
    ...env,
    focusContent: (index: number) => {
      // The press's modality, read now: the focus lands a frame later (after the commit that
      // shows the step), when the tracker no longer knows what caused it.
      const modality = env.modality.modality()
      env.scheduler.requestAnimationFrame(() => {
        const el = document.getElementById(contentIdRef.current(index))
        if (el) void focusSafely(el, env, "programmatic", modality)
      })
    },
  }))
  const contentIdRef = useRef(contentId)
  contentIdRef.current = contentId
  const disabledSteps = new Set(disabledMap.keys())
  const machineProps = {
    id: instance,
    count,
    step,
    defaultStep,
    ...(onStepChange
      ? {
          onStepChange: (next: number, d: ChangeDetails<StepperEvent>) =>
            // Sound: every step-writing transition declares one of these reasons (machine).
            onStepChange(next, {
              ...d,
              reason: d.reason as unknown as StepperChangeReason,
              cancel: d.cancel,
            }),
        }
      : {}),
    linear,
    disabledSteps,
    completedSteps: completedMap,
    titles: titleMap,
    messages,
    lang: locale,
  }
  const { view, send } = useMachine(stepperMachine, machineProps, machineEnv)
  const current = view.values.step
  const api = stepperConnect({
    instance,
    step: current,
    count,
    orientation,
    status: (i) => stepStatus(machineProps, current, i),
    reachable: (i) => stepReachable(machineProps, view.context, current, i),
    disabled: (i) => disabledSteps.has(i),
    title: (i) => titleMap.get(i) ?? "",
    hasNext: adjacentStep(machineProps, current, 1) !== null,
    hasPrev: adjacentStep(machineProps, current, -1) !== null,
    ids: {
      content: contentId,
      description: (i) => partId("stepper", instance, `description-${i}`),
    },
    messages,
    locale,
  })
  const [registry] = useState<Registry>(() => ({
    disabled: (index, on) => putDisabled(index, on ? true : undefined),
    completed: (index, value) => putCompleted(index, value),
    title: (index, text) => putTitle(index, text || undefined),
  }))
  const state: StepperRenderState = { step: current, count, orientation }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <StepperContext
      value={{
        api,
        state,
        send,
        registry,
        messages,
      }}
    >
      {renderPart("div", { ...props, children }, render, state)}
    </StepperContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<StepperRenderState>
}

function List({ render, ...rest }: PartProps<"ol">) {
  const ctx = useStepper("List")
  return renderPart("ol", mergeProps(normalizeProps(ctx.api.list()), rest), render, ctx.state)
}

export type StepperItemProps = PartProps<"li"> & {
  /** The step's index (0-based). */
  readonly index: number
  /** The step cannot be visited; Next and Previous skip it. */
  readonly disabled?: boolean
  /** Overrides the status: completed (true) or not (false) whatever the current step. */
  readonly completed?: boolean
}

function Item({ render, index, disabled = false, completed, ...rest }: StepperItemProps) {
  const ctx = useStepper("Item")
  const { registry } = ctx
  useIsoLayoutEffect(() => registry.disabled(index, disabled), [registry, index, disabled])
  useIsoLayoutEffect(() => registry.completed(index, completed), [registry, index, completed])
  const [described, setDescribed] = useState(false)
  return (
    <ItemContext value={{ index, described, setDescribed }}>
      {renderPart("li", mergeProps(normalizeProps(ctx.api.item(index)), rest), render, ctx.state)}
    </ItemContext>
  )
}

function Trigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useStepper("Trigger")
  const { index, described } = useItem("Trigger")
  const { focus, handlers } = useFocusState()
  const button = ctx.api.triggerIsButton(index)
  const content: ReactNode = (
    <>
      {children}
      <span {...normalizeProps(ctx.api.statusProps())}>{ctx.api.statusText(index)}</span>
    </>
  )
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.trigger(index, described, focus)), {
        ...handlers,
        ...(button ? { onClick: () => ctx.send({ type: "SELECT", index }) } : {}),
      }),
      ref,
    },
    rest,
  )
  // A step the user cannot reach is text, not a disabled button (no dead tab stop).
  return renderPart(button ? "button" : "span", { ...props, children: content }, render, ctx.state)
}

function Indicator({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useStepper("Indicator")
  const index = useItemIndex("Indicator")
  return renderPart(
    "span",
    { ...mergeProps(normalizeProps(ctx.api.indicator(index)), rest), children },
    render,
    ctx.state,
  )
}

function Title({ render, ref, children, ...rest }: PartProps<"span">) {
  const ctx = useStepper("Title")
  const index = useItemIndex("Title")
  const el = useRef<HTMLSpanElement | null>(null)
  const { registry } = ctx
  // The title's text names the announcement and the content region.
  // Updated after every commit (the text can change), unregistered once, on unmount: an
  // unregistering cleanup on every commit would re-render forever.
  useIsoLayoutEffect(() => {
    registry.title(index, el.current?.textContent?.trim() ?? "")
  })
  useIsoLayoutEffect(
    () => () => {
      registry.title(index, "")
    },
    [registry, index],
  )
  return renderPart(
    "span",
    {
      ...mergeProps(normalizeProps(ctx.api.title(index)), rest, { ref: composeRefs(el, ref) }),
      children,
    },
    render,
    ctx.state,
  )
}

function Description({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useStepper("Description")
  const { index, setDescribed } = useItem("Description")
  useIsoLayoutEffect(() => {
    setDescribed(true)
    return () => setDescribed(false)
  }, [setDescribed])
  return renderPart(
    "span",
    { ...mergeProps(normalizeProps(ctx.api.description(index)), rest), children },
    render,
    ctx.state,
  )
}

function Separator({ render, ...rest }: PartProps<"div">) {
  const ctx = useStepper("Separator")
  const index = useItemIndex("Separator")
  return renderPart(
    "div",
    mergeProps(normalizeProps(ctx.api.separator(index)), rest),
    render,
    ctx.state,
  )
}

export type StepperContentProps = PartProps<"div"> & {
  /** The step this content belongs to (0-based). */
  readonly index: number
}

function Content({ render, index, children, ...rest }: StepperContentProps) {
  const ctx = useStepper("Content")
  const { focus, handlers } = useFocusState()
  return renderPart(
    "div",
    {
      ...mergeProps(joinHandlers(normalizeProps(ctx.api.content(index, focus)), handlers), rest),
      children,
    },
    render,
    ctx.state,
  )
}

function PrevTrigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useStepper("PrevTrigger")
  const { focus, handlers } = useFocusState()
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.prevTrigger(focus)), {
        ...handlers,
        onClick: () => ctx.send({ type: "PREV" }),
      }),
      ref,
    },
    rest,
  )
  return renderPart(
    "button",
    { ...props, children: children ?? ctx.messages.prevLabel },
    render,
    ctx.state,
  )
}

function NextTrigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useStepper("NextTrigger")
  const { focus, handlers } = useFocusState()
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.nextTrigger(focus)), {
        ...handlers,
        onClick: () => ctx.send({ type: "NEXT" }),
      }),
      ref,
    },
    rest,
  )
  return renderPart(
    "button",
    { ...props, children: children ?? ctx.messages.nextLabel },
    render,
    ctx.state,
  )
}

function Progress({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useStepper("Progress")
  return renderPart(
    "span",
    {
      ...mergeProps(normalizeProps(ctx.api.progress()), rest),
      children: children ?? ctx.api.progressText,
    },
    render,
    ctx.state,
  )
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
