"use client"

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
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
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
  readonly api: Api
  readonly state: ReasoningRenderState
  readonly send: (event: ReasoningEvent) => void
  readonly content: { current: HTMLElement | null }
}
const ReasoningContext = createContext<Ctx | null>(null)
function useReasoning(part: string): Ctx {
  const ctx = useContext(ReasoningContext)
  if (!ctx) throw new Error(`Reasoning.${part} must be inside Reasoning.Root`)
  return ctx
}

export type ReasoningRootProps = ComponentPropsWithRef<"div"> & {
  /** The model is thinking (your runtime's streaming flag for the reasoning). */
  readonly thinking: boolean
  readonly open?: boolean
  readonly defaultOpen?: boolean
  /** `details.reason`: "auto" (the lifecycle) or "trigger" (the user). */
  readonly onOpenChange?: (open: boolean, details: ChangeDetails<ReasoningEvent>) => void
  /** Seconds, from your runtime; else measured on the Environment's clock. */
  readonly duration?: number
  /** Milliseconds before the automatic close (default 1000). */
  readonly autoCloseDelay?: number
  /** Announce "Thinking…" and "Thought for N seconds" (default true). */
  readonly announce?: boolean
  readonly messages?: MessageOverrides<ReasoningMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly render?: RenderProp<ReasoningRenderState>
}

function Root({
  thinking,
  open,
  defaultOpen,
  onOpenChange,
  duration,
  autoCloseDelay,
  announce,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: ReasoningRootProps) {
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("reasoning", reasoningMessages, ownMessages)
  const content = useRef<HTMLElement | null>(null)
  const [machineEnv] = useState(() => ({
    ...env,
    focusInside: () => {
      const el = content.current
      return el?.contains(el.ownerDocument.activeElement) === true
    },
  }))
  const machineProps = {
    id: instance,
    thinking,
    open,
    defaultOpen,
    ...(onOpenChange ? { onOpenChange } : {}),
    duration,
    autoCloseDelay,
    announce,
    messages,
    lang: locale,
  }
  const { view, send } = useMachine(reasoningMachine, machineProps, machineEnv)
  const isOpen = view.values.open
  const isThinking = view.state === "thinking"
  const shown = reasoningDuration(machineProps, view.context)
  const api = reasoningConnect({
    instance,
    open: isOpen,
    thinking: isThinking,
    duration: shown,
    ids: { content: partId("reasoning", instance, "content") },
    messages,
    locale,
  })
  const state: ReasoningRenderState = { open: isOpen, thinking: isThinking, duration: shown }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <ReasoningContext value={{ api, state, send, content }}>
      {renderPart("div", { ...props, children }, render, state)}
    </ReasoningContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<ReasoningRenderState>
}

function Trigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useReasoning("Trigger")
  const env = useEnvironment()
  // Tracking from mount, so the press that focuses it is already known as a pointer one.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.trigger({ focused, modality })), {
        onClick: () => ctx.send({ type: "TOGGLE" }),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children: children ?? ctx.api.label }, render, ctx.state)
}

function Content({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useReasoning("Content")
  if (!ctx.state.open) return null
  return renderPart(
    "div",
    {
      ...mergeProps(normalizeProps(ctx.api.content()), rest, {
        ref: composeRefs(ctx.content, ref),
      }),
      children,
    },
    render,
    ctx.state,
  )
}

/** The parts, by name: `reasoning.parts.ts` re-exports them as the `Reasoning` namespace. */
export { Content, Root, Trigger }
