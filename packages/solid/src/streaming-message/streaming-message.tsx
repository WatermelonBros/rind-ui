/** @jsxImportSource solid-js */
import {
  announcerCapability,
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
  type Accessor,
  createContext,
  createMemo,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
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
  readonly instance: Accessor<string>
}
const StreamingMessageContext = createContext<Ctx>()
function useStreamingMessage(part: string): Ctx {
  const ctx = useContext(StreamingMessageContext)
  if (!ctx) throw new Error(`StreamingMessage.${part} must be inside StreamingMessage.Root`)
  return ctx
}

export type StreamingMessageRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Everything received so far. */
  readonly text: string
  /** The response's status, from your chat runtime. */
  readonly status: StreamingStatus
  /** Reveal bursty chunks evenly (default true); off under reduced motion. */
  readonly smooth?: boolean | StreamingSmooth | undefined
  /** What is announced (default "status": the lifecycle only). */
  readonly announce?: StreamingAnnounce | undefined
  readonly messages?: MessageOverrides<StreamingMessageMessages> | undefined
  /** Default: the provider's locale (sentence splitting). */
  readonly locale?: string | undefined
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<StreamingMessageRenderState> | undefined
  readonly children?: JSX.Element
}

function Root(props: StreamingMessageRootProps) {
  const [local, rest] = splitProps(props, [
    "text",
    "status",
    "smooth",
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
  const messages = useMessages("streaming-message", streamingMessageMessages, () => local.messages)
  const machineProps = createMemo(() => ({
    id: instance(),
    text: local.text,
    status: local.status,
    smooth: local.smooth,
    announce: local.announce,
    messages: messages(),
    lang: loc().locale,
  }))
  const { view, send } = useMachine(streamingMessageMachine, machineProps, env)
  // Read after hydration, then followed: the server and the first client render agree.
  afterMount(() => {
    send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    onCleanup(
      env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
    )
  })
  const machineState = () => view().state as StreamingMessageState
  const api = createMemo(() =>
    streamingMessageConnect({ instance: instance(), state: machineState(), plain: false }),
  )
  const state = reactive<StreamingMessageRenderState>(() => ({
    state: machineState(),
    text: displayedText(machineState(), machineProps(), view().context),
    busy: api().busy,
  }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <StreamingMessageContext.Provider value={{ state, instance }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </StreamingMessageContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<StreamingMessageRenderState> | undefined
  readonly children?: JSX.Element
}

export type StreamingMessageContentProps = Omit<
  PartProps<JSX.HTMLAttributes<HTMLDivElement>>,
  "children"
> & {
  /** Your renderer (markdown) called with the displayed text, or a node; default: plain text. */
  readonly children?:
    | JSX.Element
    | ((text: string, state: StreamingMessageRenderState) => JSX.Element)
}

function Content(props: StreamingMessageContentProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStreamingMessage("Content")
  const plain = () => local.children === undefined
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(
        streamingMessageConnect({
          instance: ctx.instance(),
          state: ctx.state.state,
          plain: plain(),
        }).content(),
      ),
      rest,
    ),
  )
  const children = (): JSX.Element => {
    const c = local.children
    return typeof c === "function"
      ? (c as (text: string, state: StreamingMessageRenderState) => JSX.Element)(
          ctx.state.text,
          ctx.state,
        )
      : plain()
        ? ctx.state.text
        : c
  }
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Caret(props: PartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useStreamingMessage("Caret")
  const merged = createMemo(() =>
    mergeProps(
      normalizeProps(
        streamingMessageConnect({
          instance: ctx.instance(),
          state: ctx.state.state,
          plain: false,
        }).caret(),
      ),
      rest,
    ),
  )
  const children = () => local.children
  return (
    <Show when={ctx.state.busy}>
      {untrack(() =>
        renderPart(local.render, merged, ctx.state, children, (p) => (
          <span {...p}>{children()}</span>
        )),
      )}
    </Show>
  )
}

/** The parts, by name: `streaming-message.parts.ts` re-exports them as the `StreamingMessage` namespace. */
export { Caret, Content, Root }
