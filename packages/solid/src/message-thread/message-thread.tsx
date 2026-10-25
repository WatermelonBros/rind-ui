/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
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
    "message-thread": MessageThreadMessages
  }
}

/** What every part's `render` receives. */
export interface MessageThreadRenderState {
  readonly state: MessageThreadState
  readonly anchor: ThreadAnchor
  readonly unread: number
  readonly atBottom: boolean
}

type Api = ReturnType<typeof messageThreadConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: MessageThreadRenderState
  readonly send: ReturnType<typeof useMachine<typeof messageThreadMachine>>["send"]
  readonly threshold: Accessor<number>
  readonly loadingOlder: Accessor<boolean>
  readonly loadOlder: () => void
  readonly setAtBottom: (at: boolean) => void
  /** The Viewport's controller, set while it is mounted. */
  readonly stick: { current: StickController | null }
  readonly viewport: { current: HTMLElement | null }
  readonly turn: { current: ((b: "smooth" | "instant") => void) | null }
}
const MessageThreadContext = createContext<Ctx>()
function useThread(part: string): Ctx {
  const ctx = useContext(MessageThreadContext)
  if (!ctx) throw new Error(`MessageThread.${part} must be inside MessageThread.Root`)
  return ctx
}

/** A part's own focus, tracked from mount so the focusing press is already known. */
function useFocusState() {
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return {
    focus: () => ({ focused: focused(), modality: modality() }),
    // Only the part itself, not a descendant (a message's own buttons).
    handlers: {
      onFocusIn: (e: FocusEvent) => setFocused(e.target === e.currentTarget),
      onFocusOut: (e: FocusEvent) => {
        if (e.target === e.currentTarget) setFocused(false)
      },
    },
  }
}

const articles = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>('[data-part="message"]'))

export type MessageThreadRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Messages in the thread (or loaded). */
  readonly count: number
  /** The thread's full length when larger than what is loaded (`-1`: unknown). */
  readonly total?: number | undefined
  /** The newest message is the user's: the view goes back to it. */
  readonly lastFromUser?: boolean | undefined
  /** "bottom" follows new content; "top" scrolls the user's new message to the top. */
  readonly anchor?: ThreadAnchor | undefined
  /** How near the bottom, in px, counts as at the bottom (default 32). */
  readonly bottomThreshold?: number | undefined
  /** Older messages are loading (`aria-busy`). */
  readonly loadingOlder?: boolean | undefined
  /** The top was reached: load older messages. */
  readonly onLoadOlder?: (() => void) | undefined
  readonly messages?: MessageOverrides<MessageThreadMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<MessageThreadRenderState> | undefined
  readonly children?: JSX.Element
}

function Root(props: MessageThreadRootProps) {
  const [local, rest] = splitProps(props, [
    "count",
    "total",
    "lastFromUser",
    "anchor",
    "bottomThreshold",
    "loadingOlder",
    "onLoadOlder",
    "messages",
    "locale",
    "render",
    "id",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const loc = useLocale(() => local.locale)
  const messages = useMessages("message-thread", messageThreadMessages, () => local.messages)
  const stick: { current: StickController | null } = { current: null }
  const viewport: { current: HTMLElement | null } = { current: null }
  /** The Viewport's top-layout reveal (it owns the reserve below the turn). */
  const turn: { current: ((b: "smooth" | "instant") => void) | null } = { current: null }
  const machineEnv = {
    scrollToBottom: (b: "smooth" | "instant") => stick.current?.scrollToBottom(b),
    revealTurn: (b: "smooth" | "instant") => turn.current?.(b),
    focusLast: () => {
      const last = viewport.current ? articles(viewport.current).at(-1) : undefined
      last?.focus({ preventScroll: true })
    },
  }
  const anchor = () => local.anchor ?? "bottom"
  const { view, send } = useMachine(
    messageThreadMachine,
    createMemo(() => ({
      count: local.count,
      lastFromUser: local.lastFromUser ?? false,
      anchor: anchor(),
    })),
    machineEnv,
  )
  afterMount(() => {
    send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    onCleanup(
      env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
    )
  })
  const [bottom, setAtBottom] = createSignal(true)
  const machineState = () => view().state as MessageThreadState
  const api = createMemo(() =>
    messageThreadConnect({
      instance: instance(),
      state: machineState(),
      anchor: anchor(),
      count: local.count,
      total: local.total,
      unread: view().context.unread,
      atBottom: bottom(),
      loadingOlder: local.loadingOlder ?? false,
      messages: messages(),
      locale: loc().locale,
    }),
  )
  const state = reactive<MessageThreadRenderState>(() => ({
    state: machineState(),
    anchor: anchor(),
    unread: view().context.unread,
    atBottom: bottom(),
  }))
  const ctx: Ctx = {
    api,
    state,
    send,
    threshold: () => local.bottomThreshold ?? 32,
    loadingOlder: () => local.loadingOlder ?? false,
    loadOlder: () => local.onLoadOlder?.(),
    setAtBottom,
    stick,
    viewport,
    turn,
  }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <MessageThreadContext.Provider value={ctx}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </MessageThreadContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<MessageThreadRenderState> | undefined
  readonly children?: JSX.Element
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

function Viewport(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useThread("Viewport")
  const [el, setEl] = createSignal<Element | null>(null)
  const [content, setContent] = createSignal<Element | null>(null)
  const [sentinel, setSentinel] = createSignal<Element | null>(null)
  const [spacer, setSpacer] = createSignal<Element | null>(null)
  /** The user's turn the top layout keeps reachable at the viewport's top. */
  let anchored: HTMLElement | null = null
  /** Room below the anchored turn so it can sit at the top while the answer is short. */
  const reserve = () => {
    const viewport = untrack(el) as HTMLElement | null
    const room = untrack(spacer) as HTMLElement | null
    if (!viewport || !room) return
    if (!anchored?.isConnected) {
      room.style.blockSize = "0px"
      return
    }
    const below = room.getBoundingClientRect().top - anchored.getBoundingClientRect().top
    room.style.blockSize = `${Math.max(0, viewport.clientHeight - below)}px`
  }
  let fromBottom = 0
  let firstMessage: Element | null = null
  // A prepend (the first message changed, the old one still there): keep the reading place.
  const keepPlace = () => {
    const viewport = untrack(el) as HTMLElement | null
    if (!viewport) return
    const first = viewport.querySelector('[data-part="message"]')
    const before = firstMessage
    firstMessage = first
    if (before && first && before !== first && before.isConnected) {
      ctx.stick.current?.restore(fromBottom)
    }
    fromBottom = viewport.scrollHeight - viewport.scrollTop
  }
  afterMount(() => {
    createEffect(() => {
      const viewport = el()
      if (!(viewport instanceof HTMLElement)) return
      const threshold = ctx.threshold()
      ctx.viewport.current = viewport
      const report = () => ctx.setAtBottom(atBottom(viewport, untrack(ctx.threshold)))
      const controller = stickToBottom(viewport, untrack(content) as HTMLElement | null, {
        threshold,
        onUserScroll: (fact) => ctx.send({ type: "SCROLLED", ...fact }),
        onEscape: () => ctx.send({ type: "ESCAPE" }),
        following: () => ctx.state.state === "following" && ctx.state.anchor === "bottom",
        // The top layout never follows: growth that leaves the bottom is a fact to report.
        onResize: () => {
          reserve()
          report()
          if (ctx.state.state === "following" && !atBottom(viewport, threshold)) {
            ctx.send({ type: "SCROLLED", atBottom: false, up: false })
          }
        },
      })
      ctx.stick.current = controller
      ctx.turn.current = (b) => {
        const last = articles(viewport).at(-1)
        if (!last) return
        anchored = last
        reserve()
        controller.scrollChildToTop(last, b)
      }
      // Start at the bottom: a thread opens on its latest message.
      viewport.scrollTop = viewport.scrollHeight
      const onScroll = () => {
        fromBottom = viewport.scrollHeight - viewport.scrollTop
        report()
      }
      viewport.addEventListener("scroll", onScroll, { passive: true })
      report()
      keepPlace()
      // Messages come and go in the consumer's own list: each change checks for a prepend.
      const observer = new MutationObserver(keepPlace)
      observer.observe(viewport, { childList: true, subtree: true })
      onCleanup(() => {
        observer.disconnect()
        viewport.removeEventListener("scroll", onScroll)
        controller.destroy()
        ctx.stick.current = null
        ctx.turn.current = null
      })
    })
    createEffect(() => {
      const viewport = el()
      const top = sentinel()
      if (!(viewport instanceof HTMLElement) || !(top instanceof HTMLElement)) return
      onCleanup(
        observeTop(viewport, top, () => {
          if (!untrack(ctx.loadingOlder)) ctx.loadOlder()
        }),
      )
    })
  })
  const named = () => rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const focusState = useFocusState()
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().viewport(named(), focusState.focus())), {
          ...focusState.handlers,
          onKeyDown: (e: KeyboardEvent) => {
            const action = feedKeyAction({
              key: e.key,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              targetOwnsKeys: ownsKeys(e.target),
            })
            if (!action) return
            const viewport = e.currentTarget as HTMLElement
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
            ctx.stick.current?.scrollChildIntoView(target)
          },
        }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => (
    <div ref={setContent} role="none" style={{ display: "flow-root" }}>
      <div ref={setSentinel} aria-hidden="true" style={{ "block-size": "1px" }} />
      {local.children}
      <div ref={setSpacer} aria-hidden="true" data-reserve="" />
    </div>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type MessageThreadMessageProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The message's index in the whole thread (0 is the oldest). */
  readonly index: number
  /** Who wrote it: names the article ("You", "Assistant"). */
  readonly from: MessageFrom
}

function Message(props: MessageThreadMessageProps) {
  const [local, rest] = splitProps(props, ["render", "index", "from", "children"])
  const ctx = useThread("Message")
  const named = () => rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const { focus, handlers } = useFocusState()
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        normalizeProps(
          ctx.api().message({
            index: local.index,
            from: local.from,
            named: named(),
            focus: focus(),
          }),
        ),
        handlers,
      ),
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function JumpToLatest(props: PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useThread("JumpToLatest")
  const env = useEnvironment()
  const named = () => rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().jumpToLatest(named())), {
        onClick: () => ctx.send({ type: "JUMP", modality: env.modality.modality() }),
      }),
      rest,
    ),
  )
  const children = () => local.children
  return (
    <Show when={ctx.api().showJump}>
      {untrack(() =>
        renderPart(local.render, merged, ctx.state, children, (p) => (
          <button {...p}>{children()}</button>
        )),
      )}
    </Show>
  )
}

/** The parts, by name: `message-thread.parts.ts` re-exports them as the `MessageThread` namespace. */
export { JumpToLatest, Message, Root, Viewport }
