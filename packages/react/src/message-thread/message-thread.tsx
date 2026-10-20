"use client"

import {
  atBottom,
  feedKeyAction,
  type MessageFrom,
  type MessageOverrides,
  type MessageThreadMessages,
  type MessageThreadState,
  messageThreadConnect,
  messageThreadMachine,
  messageThreadMessages,
  observeTop,
  type StickController,
  stickToBottom,
  TABBABLE,
  type ThreadAnchor,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
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
    "message-thread": MessageThreadMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
export interface MessageThreadRenderState {
  readonly state: MessageThreadState
  readonly anchor: ThreadAnchor
  readonly unread: number
  readonly atBottom: boolean
}

type Api = ReturnType<typeof messageThreadConnect>

interface Ctx {
  readonly api: Api
  readonly state: MessageThreadRenderState
  readonly send: ReturnType<typeof useMachine<typeof messageThreadMachine>>["send"]
  readonly threshold: number
  readonly loadingOlder: boolean
  readonly onLoadOlder: (() => void) | undefined
  readonly setAtBottom: (at: boolean) => void
  /** The Viewport's controller, set while it is mounted. */
  readonly stick: { current: StickController | null }
  readonly viewport: { current: HTMLElement | null }
  readonly turn: { current: ((b: "smooth" | "instant") => void) | null }
}
const MessageThreadContext = createContext<Ctx | null>(null)
function useThread(part: string): Ctx {
  const ctx = useContext(MessageThreadContext)
  if (!ctx) throw new Error(`MessageThread.${part} must be inside MessageThread.Root`)
  return ctx
}

/** A part's own focus, tracked from mount so the focusing press is already known. */
function useFocusState() {
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return {
    focus: { focused, modality },
    // Only the part itself, not a descendant (a message's own buttons).
    handlers: {
      onFocus: (e: React.FocusEvent) => setFocused(e.target === e.currentTarget),
      onBlur: (e: React.FocusEvent) => {
        if (e.target === e.currentTarget) setFocused(false)
      },
    },
  }
}

const articles = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>('[data-part="message"]'))

export type MessageThreadRootProps = ComponentPropsWithRef<"div"> & {
  /** Messages in the thread (or loaded). */
  readonly count: number
  /** The thread's full length when larger than what is loaded (`-1`: unknown). */
  readonly total?: number
  /** The newest message is the user's: the view goes back to it. */
  readonly lastFromUser?: boolean
  /** "bottom" follows new content; "top" scrolls the user's new message to the top. */
  readonly anchor?: ThreadAnchor
  /** How near the bottom, in px, counts as at the bottom (default 32). */
  readonly bottomThreshold?: number
  /** Older messages are loading (`aria-busy`). */
  readonly loadingOlder?: boolean
  /** The top was reached: load older messages. */
  readonly onLoadOlder?: () => void
  readonly messages?: MessageOverrides<MessageThreadMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly render?: RenderProp<MessageThreadRenderState>
}

function Root({
  count,
  total,
  lastFromUser = false,
  anchor = "bottom",
  bottomThreshold = 32,
  loadingOlder = false,
  onLoadOlder,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: MessageThreadRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("message-thread", messageThreadMessages, ownMessages)
  const stick = useRef<StickController | null>(null)
  const viewport = useRef<HTMLElement | null>(null)
  /** The Viewport's top-layout reveal (it owns the reserve below the turn). */
  const turn = useRef<((b: "smooth" | "instant") => void) | null>(null)
  const [machineEnv] = useState(() => ({
    scrollToBottom: (b: "smooth" | "instant") => stick.current?.scrollToBottom(b),
    revealTurn: (b: "smooth" | "instant") => turn.current?.(b),
    focusLast: () => {
      const last = viewport.current ? articles(viewport.current).at(-1) : undefined
      last?.focus({ preventScroll: true })
    },
  }))
  const { view, send } = useMachine(
    messageThreadMachine,
    { count, lastFromUser, anchor },
    machineEnv,
  )
  useEffect(() => {
    send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    return env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced }))
  }, [env, send])
  const [bottom, setAtBottom] = useState(true)
  const state = view.state as MessageThreadState
  const api = messageThreadConnect({
    instance,
    state,
    anchor,
    count,
    total,
    unread: view.context.unread,
    atBottom: bottom,
    loadingOlder,
    messages,
    locale,
  })
  const renderState: MessageThreadRenderState = {
    state,
    anchor,
    unread: view.context.unread,
    atBottom: bottom,
  }
  const ctx: Ctx = {
    api,
    state: renderState,
    send,
    threshold: bottomThreshold,
    loadingOlder,
    onLoadOlder,
    setAtBottom,
    stick,
    viewport,
    turn,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <MessageThreadContext value={ctx}>
      {renderPart("div", { ...props, children }, render, renderState)}
    </MessageThreadContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<MessageThreadRenderState>
}

/** The first focusable element after (or before) `root` in document order. */
function focusableBeside(root: Element, after: boolean): HTMLElement | null {
  const all = Array.from(root.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => !root.contains(el) && el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled,
  )
  const beside = all.filter((el) => {
    const pos = root.compareDocumentPosition(el)
    return after ? pos & Node.DOCUMENT_POSITION_FOLLOWING : pos & Node.DOCUMENT_POSITION_PRECEDING
  })
  return (after ? beside[0] : beside.at(-1)) ?? null
}

const ownsKeys = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, [role="textbox"], [aria-keyshortcuts]')
  )
}

function Viewport({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useThread("Viewport")
  const el = useRef<HTMLDivElement | null>(null)
  const content = useRef<HTMLDivElement | null>(null)
  const sentinel = useRef<HTMLDivElement | null>(null)
  const spacer = useRef<HTMLDivElement | null>(null)
  /** The user's turn the top layout keeps reachable at the viewport's top. */
  const anchored = useRef<HTMLElement | null>(null)
  /** Room below the anchored turn so it can sit at the top while the answer is short. */
  // Reads refs only: one identity for the component's life.
  const [reserve] = useState(() => () => {
    const viewport = el.current
    const room = spacer.current
    const target = anchored.current
    if (!viewport || !room) return
    if (!target?.isConnected) {
      room.style.blockSize = "0px"
      return
    }
    const below = room.getBoundingClientRect().top - target.getBoundingClientRect().top
    room.style.blockSize = `${Math.max(0, viewport.clientHeight - below)}px`
  })
  const { send, threshold, setAtBottom, stick } = ctx
  const latest = useRef(ctx)
  latest.current = ctx
  const fromBottom = useRef(0)
  const firstMessage = useRef<Element | null>(null)
  useEffect(() => {
    const viewport = el.current
    if (!viewport) return
    ctx.viewport.current = viewport
    const report = () => setAtBottom(atBottom(viewport, latest.current.threshold))
    const controller = stickToBottom(viewport, content.current, {
      threshold,
      onUserScroll: (fact) => send({ type: "SCROLLED", ...fact }),
      onEscape: () => send({ type: "ESCAPE" }),
      following: () =>
        latest.current.state.state === "following" && latest.current.state.anchor === "bottom",
      // The top layout never follows: growth that leaves the bottom is a fact to report.
      onResize: () => {
        reserve()
        report()
        if (latest.current.state.state === "following" && !atBottom(viewport, threshold)) {
          send({ type: "SCROLLED", atBottom: false, up: false })
        }
      },
    })
    stick.current = controller
    ctx.turn.current = (b) => {
      const last = articles(viewport).at(-1)
      if (!last) return
      anchored.current = last
      reserve()
      controller.scrollChildToTop(last, b)
    }
    // Start at the bottom: a thread opens on its latest message.
    viewport.scrollTop = viewport.scrollHeight
    const onScroll = () => {
      fromBottom.current = viewport.scrollHeight - viewport.scrollTop
      report()
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    report()
    return () => {
      viewport.removeEventListener("scroll", onScroll)
      controller.destroy()
      stick.current = null
      ctx.turn.current = null
    }
  }, [send, setAtBottom, stick, threshold, ctx.viewport, ctx.turn, reserve])
  // A prepend (the first message changed, the old one still there): keep the reading place.
  useIsoLayoutEffect(() => {
    const viewport = el.current
    if (!viewport) return
    const first = viewport.querySelector('[data-part="message"]')
    const before = firstMessage.current
    firstMessage.current = first
    if (before && first && before !== first && before.isConnected) {
      stick.current?.restore(fromBottom.current)
    }
    fromBottom.current = viewport.scrollHeight - viewport.scrollTop
  })
  useEffect(() => {
    const viewport = el.current
    const top = sentinel.current
    if (!viewport || !top) return
    return observeTop(viewport, top, () => {
      if (!latest.current.loadingOlder) latest.current.onLoadOlder?.()
    })
  }, [])
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const focusState = useFocusState()
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.viewport(named, focusState.focus)), {
        ...focusState.handlers,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          const action = feedKeyAction({
            key: e.key,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            targetOwnsKeys: ownsKeys(e.target),
          })
          if (!action) return
          const viewport = e.currentTarget
          if (action === "after" || action === "before") {
            const root = viewport.closest('[data-part="root"]') ?? viewport
            const target = focusableBeside(root, action === "after")
            if (!target) return
            e.preventDefault()
            target.focus()
            return
          }
          const list = articles(viewport)
          if (list.length === 0) return
          const active = (e.target as Element).closest('[data-part="message"]')
          const index = active ? list.indexOf(active as HTMLElement) : -1
          // From the viewport itself: the first message at least partly in view.
          const vr = viewport.getBoundingClientRect()
          const visible = list.findIndex((m) => m.getBoundingClientRect().bottom > vr.top)
          const from = index >= 0 ? index : Math.max(0, visible) - (action === "next" ? 1 : 0)
          const to = Math.min(list.length - 1, Math.max(0, from + (action === "next" ? 1 : -1)))
          const target = list[to]
          if (!target) return
          e.preventDefault()
          target.focus({ preventScroll: true })
          stick.current?.scrollChildIntoView(target)
        },
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart(
    "div",
    {
      ...props,
      children: (
        <div ref={content} role="none" style={{ display: "flow-root" }}>
          <div ref={sentinel} aria-hidden="true" style={{ blockSize: 1 }} />
          {children}
          <div ref={spacer} aria-hidden="true" data-reserve="" />
        </div>
      ),
    },
    render,
    ctx.state,
  )
}

export type MessageThreadMessageProps = PartProps<"div"> & {
  /** The message's index in the whole thread (0 is the oldest). */
  readonly index: number
  /** Who wrote it: names the article ("You", "Assistant"). */
  readonly from: MessageFrom
}

function Message({ render, index, from, ...rest }: MessageThreadMessageProps) {
  const ctx = useThread("Message")
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const { focus, handlers } = useFocusState()
  return renderPart(
    "div",
    mergeProps(
      joinHandlers(normalizeProps(ctx.api.message({ index, from, named, focus })), handlers),
      rest,
    ),
    render,
    ctx.state,
  )
}

function JumpToLatest({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useThread("JumpToLatest")
  const env = useEnvironment()
  if (!ctx.api.showJump) return null
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.jumpToLatest(named)), {
        onClick: () => ctx.send({ type: "JUMP", modality: env.modality.modality() }),
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

export const MessageThread = { Root, Viewport, Message, JumpToLatest }
