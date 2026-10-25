/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ChangeDetails,
  type MessageOverrides,
  partId,
  type ReasoningEvent,
  type ReasoningMessages,
  reasoningConnect,
  reasoningDuration,
  reasoningMachine,
  reasoningMessages,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    reasoning: ReasoningMessages
  }
}

/** What every part's `render` receives. */
export interface ReasoningRenderState {
  readonly open: boolean
  readonly thinking: boolean
  /** Seconds, or null when unknown. */
  readonly duration: number | null
}

type Api = ReturnType<typeof reasoningConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: ReasoningRenderState
  readonly send: (event: ReasoningEvent) => void
  readonly setContent: (el: Element | null) => void
}
const ReasoningContext = createContext<Ctx>()
function useReasoning(part: string): Ctx {
  const ctx = useContext(ReasoningContext)
  if (!ctx) throw new Error(`Reasoning.${part} must be inside Reasoning.Root`)
  return ctx
}

export type ReasoningRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The model is thinking (your runtime's streaming flag for the reasoning). */
  readonly thinking: boolean
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  /** `details.reason`: "auto" (the lifecycle) or "trigger" (the user). */
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<ReasoningEvent>) => void)
    | undefined
  /** Seconds, from your runtime; else measured on the Environment's clock. */
  readonly duration?: number | undefined
  /** Milliseconds before the automatic close (default 1000). */
  readonly autoCloseDelay?: number | undefined
  /** Announce "Thinking…" and "Thought for N seconds" (default true). */
  readonly announce?: boolean | undefined
  readonly messages?: MessageOverrides<ReasoningMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<ReasoningRenderState> | undefined
  readonly children?: JSX.Element
}

function Root(props: ReasoningRootProps) {
  const [local, rest] = splitProps(props, [
    "thinking",
    "open",
    "defaultOpen",
    "onOpenChange",
    "duration",
    "autoCloseDelay",
    "announce",
    "messages",
    "locale",
    "render",
    "id",
    "children",
  ])
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => local.id)
  const loc = useLocale(() => local.locale)
  const messages = useMessages("reasoning", reasoningMessages, () => local.messages)
  const [content, setContent] = createSignal<Element | null>(null)
  const machineEnv = {
    ...env,
    focusInside: () => {
      const el = untrack(content)
      return el?.contains(el.ownerDocument.activeElement) === true
    },
  }
  const machineProps = createMemo(() => ({
    id: instance(),
    thinking: local.thinking,
    open: local.open,
    defaultOpen: local.defaultOpen,
    ...(local.onOpenChange ? { onOpenChange: local.onOpenChange } : {}),
    duration: local.duration,
    autoCloseDelay: local.autoCloseDelay,
    announce: local.announce,
    messages: messages(),
    lang: loc().locale,
  }))
  const { view, send } = useMachine(reasoningMachine, machineProps, machineEnv)
  const isOpen = () => view().values.open
  const isThinking = () => view().state === "thinking"
  const shown = () => reasoningDuration(machineProps(), view().context)
  const api = createMemo(() =>
    reasoningConnect({
      instance: instance(),
      open: isOpen(),
      thinking: isThinking(),
      duration: shown(),
      ids: { content: partId("reasoning", instance(), "content") },
      messages: messages(),
      locale: loc().locale,
    }),
  )
  const state = reactive<ReasoningRenderState>(() => ({
    open: isOpen(),
    thinking: isThinking(),
    duration: shown(),
  }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <ReasoningContext.Provider value={{ api, state, send, setContent }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ReasoningContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<ReasoningRenderState> | undefined
  readonly children?: JSX.Element
}

function Trigger(props: PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useReasoning("Trigger")
  const env = useEnvironment()
  // Tracking from mount, so the press that focuses it is already known as a pointer one.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.api().trigger({ focused: focused(), modality: modality() })),
        {
          onClick: () => ctx.send({ type: "TOGGLE" }),
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        },
      ),
      rest,
    ),
  )
  const children = () => local.children ?? ctx.api().label
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function Content(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useReasoning("Content")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().content()), rest, { ref: ctx.setContent }),
  )
  const children = () => local.children
  return (
    <Show when={ctx.state.open}>
      {untrack(() =>
        renderPart(local.render, merged, ctx.state, children, (p) => (
          <div {...p}>{children()}</div>
        )),
      )}
    </Show>
  )
}

/** The parts, by name: `reasoning.parts.ts` re-exports them as the `Reasoning` namespace. */
export { Content, Root, Trigger }
