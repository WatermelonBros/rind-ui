"use client"

import {
  displayedText,
  type MessageOverrides,
  type StreamingAnnounce,
  type StreamingMessageMessages,
  type StreamingMessageState,
  type StreamingSmooth,
  type StreamingStatus,
  streamingMessageConnect,
  streamingMessageMachine,
  streamingMessageMessages,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "streaming-message": StreamingMessageMessages
  }
}

/** What every part's `render` receives. */
export interface StreamingMessageRenderState {
  readonly state: StreamingMessageState
  /** The displayed text (a prefix of `text` while the reveal catches up). */
  readonly text: string
  readonly busy: boolean
}

interface Ctx {
  readonly state: StreamingMessageRenderState
  readonly instance: string
}
const StreamingMessageContext = createContext<Ctx | null>(null)
function useStreamingMessage(part: string): Ctx {
  const ctx = useContext(StreamingMessageContext)
  if (!ctx) throw new Error(`StreamingMessage.${part} must be inside StreamingMessage.Root`)
  return ctx
}

export type StreamingMessageRootProps = ComponentPropsWithRef<"div"> & {
  /** Everything received so far. */
  readonly text: string
  /** The response's status, from your chat runtime. */
  readonly status: StreamingStatus
  /** Reveal bursty chunks evenly (default true); off under reduced motion. */
  readonly smooth?: boolean | StreamingSmooth
  /** What is announced (default "status": the lifecycle only). */
  readonly announce?: StreamingAnnounce
  readonly messages?: MessageOverrides<StreamingMessageMessages>
  /** Default: the provider's locale (sentence splitting). */
  readonly locale?: string
  readonly render?: RenderProp<StreamingMessageRenderState>
}

function Root({
  text,
  status,
  smooth,
  announce,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: StreamingMessageRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("streaming-message", streamingMessageMessages, ownMessages)
  const machineProps = {
    id: instance,
    text,
    status,
    smooth,
    announce,
    messages,
    lang: locale,
  }
  const { view, send } = useMachine(streamingMessageMachine, machineProps)
  // Read after hydration, then followed: the server and the first client render agree.
  useEffect(() => {
    send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    return env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced }))
  }, [env, send])
  const state = view.state as StreamingMessageState
  const api = streamingMessageConnect({ instance, state, plain: false })
  const renderState: StreamingMessageRenderState = {
    state,
    text: displayedText(state, machineProps, view.context),
    busy: api.busy,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <StreamingMessageContext value={{ state: renderState, instance }}>
      {renderPart("div", { ...props, children }, render, renderState)}
    </StreamingMessageContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<StreamingMessageRenderState>
}

export type StreamingMessageContentProps = Omit<PartProps<"div">, "children"> & {
  /** Your renderer (markdown) called with the displayed text, or a node; default: plain text. */
  readonly children?: ReactNode | ((text: string, state: StreamingMessageRenderState) => ReactNode)
}

function Content({ render, children, ...rest }: StreamingMessageContentProps) {
  const ctx = useStreamingMessage("Content")
  const plain = children === undefined
  const api = streamingMessageConnect({
    instance: ctx.instance,
    state: ctx.state.state,
    plain,
  })
  const content =
    typeof children === "function"
      ? children(ctx.state.text, ctx.state)
      : plain
        ? ctx.state.text
        : children
  return renderPart(
    "div",
    { ...mergeProps(normalizeProps(api.content()), rest), children: content },
    render,
    ctx.state,
  )
}

function Caret({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useStreamingMessage("Caret")
  if (!ctx.state.busy) return null
  const api = streamingMessageConnect({
    instance: ctx.instance,
    state: ctx.state.state,
    plain: false,
  })
  return renderPart(
    "span",
    { ...mergeProps(normalizeProps(api.caret()), rest), children },
    render,
    ctx.state,
  )
}

export const StreamingMessage = { Root, Content, Caret }
