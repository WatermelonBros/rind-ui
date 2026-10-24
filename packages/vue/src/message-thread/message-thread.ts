// Message Thread parts: wiring only. The machine owns following and the unread count, connect
// every attribute; core's stick-to-bottom reads the viewport's scrolling and growth.
import {
  atBottom,
  feedKeyAction,
  type MessageFrom,
  type MessageOverrides,
  type MessageThreadEvent,
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
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "message-thread": MessageThreadMessages
  }
}

/** What every part's slot receives. */
export interface MessageThreadRenderState {
  readonly state: MessageThreadState
  readonly anchor: ThreadAnchor
  readonly unread: number
  readonly atBottom: boolean
}

type Api = ReturnType<typeof messageThreadConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => MessageThreadRenderState
  readonly send: (event: MessageThreadEvent) => void
  readonly threshold: () => number
  readonly loadingOlder: () => boolean
  readonly loadOlder: () => void
  readonly setAtBottom: (at: boolean) => void
  /** The Viewport's controller, set while it is mounted. */
  readonly stick: { current: StickController | null }
  readonly viewport: { current: HTMLElement | null }
  readonly turn: { current: ((b: "smooth" | "instant") => void) | null }
}
const ThreadKey: InjectionKey<Ctx> = Symbol("rind-ui.message-thread")
function useThread(part: string): Ctx {
  const ctx = inject(ThreadKey, null)
  if (!ctx) throw new Error(`MessageThread.${part} must be inside MessageThread.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: MessageThreadRenderState) => VNodeChild }>

/** A part's own focus, tracked from mount so the focusing press is already known. */
function useFocusState() {
  const env = useEnvironment()
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return {
    focus: () => ({ focused: focused.value, modality: modality.value }),
    // Only the part itself, not a descendant (a message's own buttons).
    handlers: {
      onFocusin: (e: FocusEvent) => {
        focused.value = e.target === e.currentTarget
      },
      onFocusout: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused.value = false
      },
    },
  }
}

const articles = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>('[data-part="message"]'))

const isNamed = (attrs: Record<string, unknown>) =>
  attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined

const Root = defineComponent({
  name: "MessageThreadRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Messages in the thread (or loaded). */
    count: { type: Number, required: true },
    /** The thread's full length when larger than what is loaded (`-1`: unknown). */
    total: Number,
    /** The newest message is the user's: the view goes back to it. */
    lastFromUser: Boolean,
    /** "bottom" follows new content; "top" scrolls the user's new message to the top. */
    anchor: { type: String as PropType<ThreadAnchor>, default: "bottom" },
    /** How near the bottom, in px, counts as at the bottom (default 32). */
    bottomThreshold: { type: Number, default: 32 },
    /** Older messages are loading (`aria-busy`). */
    loadingOlder: Boolean,
    messages: Object as PropType<MessageOverrides<MessageThreadMessages>>,
    /** Default: the provider's locale. */
    locale: String,
  },
  emits: {
    /** The top was reached: load older messages. */
    loadOlder: () => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const loc = useLocale(() => props.locale)
    const messages = useMessages("message-thread", messageThreadMessages, () => props.messages)
    const stick: Ctx["stick"] = { current: null }
    const viewport: Ctx["viewport"] = { current: null }
    /** The Viewport's top-layout reveal (it owns the reserve below the turn). */
    const turn: Ctx["turn"] = { current: null }
    const machineEnv = {
      scrollToBottom: (b: "smooth" | "instant") => stick.current?.scrollToBottom(b),
      revealTurn: (b: "smooth" | "instant") => turn.current?.(b),
      focusLast: () => {
        const last = viewport.current ? articles(viewport.current).at(-1) : undefined
        last?.focus({ preventScroll: true })
      },
    }
    const { view, send } = useMachine(
      messageThreadMachine,
      () => ({ count: props.count, lastFromUser: props.lastFromUser, anchor: props.anchor }),
      machineEnv,
    )
    onMounted(() => {
      send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
      onBeforeUnmount(
        env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
      )
    })
    const bottom = shallowRef(true)
    const api = computed(() =>
      messageThreadConnect({
        instance: instance(),
        state: view.value.state as MessageThreadState,
        anchor: props.anchor,
        count: props.count,
        total: props.total,
        unread: view.value.context.unread,
        atBottom: bottom.value,
        loadingOlder: props.loadingOlder,
        messages: messages.value,
        locale: loc.value.locale,
      }),
    )
    const state = (): MessageThreadRenderState => ({
      state: view.value.state as MessageThreadState,
      anchor: props.anchor,
      unread: view.value.context.unread,
      atBottom: bottom.value,
    })
    provide(ThreadKey, {
      api: () => api.value,
      state,
      send,
      threshold: () => props.bottomThreshold,
      loadingOlder: () => props.loadingOlder,
      loadOlder: () => emit("loadOlder"),
      setAtBottom: (at) => {
        bottom.value = at
      },
      stick,
      viewport,
      turn,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

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

const Viewport = defineComponent({
  name: "MessageThreadViewport",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useThread("Viewport")
    const el = shallowRef<Element | null>(null)
    const content = shallowRef<Element | null>(null)
    const sentinel = shallowRef<Element | null>(null)
    const spacer = shallowRef<Element | null>(null)
    /** The user's turn the top layout keeps reachable at the viewport's top. */
    let anchored: HTMLElement | null = null
    /** Room below the anchored turn so it can sit at the top while the answer is short. */
    const reserve = () => {
      const viewport = el.value as HTMLElement | null
      const room = spacer.value as HTMLElement | null
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
      const viewport = el.value as HTMLElement | null
      if (!viewport) return
      const first = viewport.querySelector('[data-part="message"]')
      const before = firstMessage
      firstMessage = first
      if (before && first && before !== first && before.isConnected) {
        ctx.stick.current?.restore(fromBottom)
      }
      fromBottom = viewport.scrollHeight - viewport.scrollTop
    }
    onMounted(() => {
      const viewport = el.value
      if (!(viewport instanceof HTMLElement)) return
      ctx.viewport.current = viewport
      const report = () => ctx.setAtBottom(atBottom(viewport, ctx.threshold()))
      const threshold = ctx.threshold()
      const controller = stickToBottom(viewport, content.value as HTMLElement | null, {
        threshold,
        onUserScroll: (fact) => ctx.send({ type: "SCROLLED", ...fact }),
        onEscape: () => ctx.send({ type: "ESCAPE" }),
        following: () => ctx.state().state === "following" && ctx.state().anchor === "bottom",
        // The top layout never follows: growth that leaves the bottom is a fact to report.
        onResize: () => {
          reserve()
          report()
          if (ctx.state().state === "following" && !atBottom(viewport, threshold)) {
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
      const top = sentinel.value
      const stopTop = top
        ? observeTop(viewport, top as HTMLElement, () => {
            if (!ctx.loadingOlder()) ctx.loadOlder()
          })
        : undefined
      onBeforeUnmount(() => {
        stopTop?.()
        viewport.removeEventListener("scroll", onScroll)
        controller.destroy()
        ctx.stick.current = null
        ctx.turn.current = null
      })
    })
    onUpdated(keepPlace)
    const focusState = useFocusState()
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(ctx.api().viewport(isNamed(attrs), focusState.focus())),
              {
                ...focusState.handlers,
                onKeydown: (e: KeyboardEvent) => {
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
                  const from =
                    index >= 0 ? index : Math.max(0, visible) - (action === "next" ? 1 : 0)
                  const to = Math.min(
                    list.length - 1,
                    Math.max(0, from + (action === "next" ? 1 : -1)),
                  )
                  const target = list[to]
                  if (!target) return
                  e.preventDefault()
                  target.focus({ preventScroll: true })
                  ctx.stick.current?.scrollChildIntoView(target)
                },
              },
            ),
            ref: refTo(el),
          },
          attrs,
        ),
        h("div", { ref: refTo(content), role: "none", style: { display: "flow-root" } }, [
          h("div", { ref: refTo(sentinel), "aria-hidden": "true", style: { blockSize: "1px" } }),
          slots.default?.(ctx.state()),
          h("div", { ref: refTo(spacer), "aria-hidden": "true", "data-reserve": "" }),
        ]),
        props.asChild,
      )
  },
})

const Message = defineComponent({
  name: "MessageThreadMessage",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The message's index in the whole thread (0 is the oldest). */
    index: { type: Number, required: true },
    /** Who wrote it: names the article ("You", "Assistant"). */
    from: { type: String as PropType<MessageFrom>, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useThread("Message")
    const { focus, handlers } = useFocusState()
    return () =>
      renderPart(
        "div",
        mergeProps(
          joinHandlers(
            normalizeProps(
              ctx.api().message({
                index: props.index,
                from: props.from,
                named: isNamed(attrs),
                focus: focus(),
              }),
            ),
            handlers,
          ),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const JumpToLatest = defineComponent({
  name: "MessageThreadJumpToLatest",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useThread("JumpToLatest")
    const env = useEnvironment()
    return () => {
      const api = ctx.api()
      if (!api.showJump) return null
      return renderPart(
        "button",
        mergeProps(
          joinHandlers(normalizeProps(api.jumpToLatest(isNamed(attrs))), {
            onClick: () => ctx.send({ type: "JUMP", modality: env.modality.modality() }),
          }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `message-thread.parts.ts` re-exports them as the `MessageThread` namespace. */
export { JumpToLatest, Message, Root, Viewport }
