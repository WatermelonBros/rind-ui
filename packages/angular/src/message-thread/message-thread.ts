// Message Thread parts: wiring only. The machine owns following and the unread count, connect
// every attribute; core's stick-to-bottom reads the viewport's scrolling and growth.
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
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
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

/** The thread's state, for the template (`#t="rindMessageThreadRoot"`, `t.state()`). */
export interface MessageThreadRenderState {
  readonly state: MessageThreadState
  readonly anchor: ThreadAnchor
  readonly unread: number
  readonly atBottom: boolean
}

type Api = ReturnType<typeof messageThreadConnect>

const THREAD = new InjectionToken<MessageThreadRoot>("rind-ui.message-thread")

function injectThread(part: string): MessageThreadRoot {
  const root = inject(THREAD, { optional: true })
  if (!root) throw new Error(`rindMessageThread${part} must be inside rindMessageThreadRoot`)
  return root
}

/** A part's own focus, tracked from mount so the focusing press is already known. */
function injectFocusState() {
  const env = injectEnvironment()
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  return {
    focus: () => ({ focused: focused(), modality: modality() }),
    // Only the part itself, not a descendant (a message's own buttons).
    handlers: {
      onFocusIn: (e: FocusEvent) => focused.set(e.target === e.currentTarget),
      onFocusOut: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused.set(false)
      },
    },
  }
}

/** The consumer named the part itself (its static `aria-label` / `aria-labelledby`). */
function injectNamed(): boolean {
  const label = inject(new HostAttributeToken("aria-label"), { optional: true })
  const labelledBy = inject(new HostAttributeToken("aria-labelledby"), { optional: true })
  return label !== null || labelledBy !== null
}

const articles = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>('[data-part="message"]'))

/**
 * A chat's messages that follow new content: `<div rindMessageThreadRoot [count]="n">` with
 * the Viewport holding one Message per message, and a JumpToLatest.
 */
@Directive({
  selector: "[rindMessageThreadRoot]",
  exportAs: "rindMessageThreadRoot",
  providers: [{ provide: THREAD, useExisting: forwardRef(() => MessageThreadRoot) }],
})
export class MessageThreadRoot {
  readonly id = input<string>()
  /** Messages in the thread (or loaded). */
  readonly count = input.required<number>()
  /** The thread's full length when larger than what is loaded (`-1`: unknown). */
  readonly total = input<number>()
  /** The newest message is the user's: the view goes back to it. */
  readonly lastFromUser = input(false, { transform: booleanAttribute })
  /** "bottom" follows new content; "top" scrolls the user's new message to the top. */
  readonly anchor = input<ThreadAnchor>("bottom")
  /** How near the bottom, in px, counts as at the bottom (default 32). */
  readonly bottomThreshold = input(32)
  /** Older messages are loading (`aria-busy`). */
  readonly loadingOlder = input(false, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<MessageThreadMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  /** The top was reached: load older messages. */
  readonly loadOlder = output<void>()

  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly send: (event: MessageThreadEvent) => void
  /** @internal */
  readonly atBottom = signal(true)
  /** @internal The Viewport's controller, set while it is mounted. */
  readonly stick: { current: StickController | null } = { current: null }
  /** @internal */
  readonly viewport: { current: HTMLElement | null } = { current: null }
  /** @internal The Viewport's top-layout reveal (it owns the reserve below the turn). */
  readonly turn: { current: ((b: "smooth" | "instant") => void) | null } = { current: null }
  /** The thread's state, for the template. */
  readonly state: Signal<MessageThreadRenderState>

  constructor() {
    const env = injectEnvironment()
    const instance = injectRootId(() => this.id())
    const loc = injectLocale(() => this.locale())
    const messages = injectMessages("message-thread", messageThreadMessages, () => this.messages())
    const { view, send } = injectMachine(
      messageThreadMachine,
      () => ({ count: this.count(), lastFromUser: this.lastFromUser(), anchor: this.anchor() }),
      {
        scrollToBottom: (b: "smooth" | "instant") => this.stick.current?.scrollToBottom(b),
        revealTurn: (b: "smooth" | "instant") => this.turn.current?.(b),
        focusLast: () => {
          const last = this.viewport.current ? articles(this.viewport.current).at(-1) : undefined
          last?.focus({ preventScroll: true })
        },
      },
    )
    this.send = send
    this.api = computed(() =>
      messageThreadConnect({
        instance: instance(),
        state: view().state as MessageThreadState,
        anchor: this.anchor(),
        count: this.count(),
        total: this.total(),
        unread: view().context.unread,
        atBottom: this.atBottom(),
        loadingOlder: this.loadingOlder(),
        messages: messages(),
        locale: loc().locale,
      }),
    )
    this.state = computed(() => ({
      state: view().state as MessageThreadState,
      anchor: this.anchor(),
      unread: view().context.unread,
      atBottom: this.atBottom(),
    }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "anchor",
          "bottomthreshold",
          "count",
          "id",
          "lastfromuser",
          "loadingolder",
          "locale",
          "messages",
          "total",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
      destroy.onDestroy(
        env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
      )
    })
  }
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

/** The scrolling feed: it follows new content and keeps the reading place on a prepend. */
@Component({
  selector: "[rindMessageThreadViewport]",
  exportAs: "rindMessageThreadViewport",
  encapsulation: ViewEncapsulation.None,
  template: `<div #content role="none" style="display: flow-root"><div #sentinel aria-hidden="true" style="block-size: 1px"></div><ng-content /><div #spacer aria-hidden="true" data-reserve=""></div></div>`,
})
export class MessageThreadViewport {
  private readonly content = viewChild.required<ElementRef<HTMLElement>>("content")
  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>("sentinel")
  private readonly spacer = viewChild.required<ElementRef<HTMLElement>>("spacer")

  constructor() {
    const root = injectThread("Viewport")
    const el: HTMLElement = inject(ElementRef).nativeElement
    const named = injectNamed()
    const focusState = injectFocusState()
    bindProps(() =>
      joinHandlers(root.api().viewport(named, focusState.focus()), {
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
            const thread = viewport.closest('[data-part="root"]') ?? viewport
            const target = focusableBeside(thread, action === "after")
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
          root.stick.current?.scrollChildIntoView(target)
        },
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    /** The user's turn the top layout keeps reachable at the viewport's top. */
    let anchored: HTMLElement | null = null
    /** Room below the anchored turn so it can sit at the top while the answer is short. */
    const reserve = () => {
      const room = this.spacer().nativeElement
      if (!anchored?.isConnected) {
        room.style.blockSize = "0px"
        return
      }
      const below = room.getBoundingClientRect().top - anchored.getBoundingClientRect().top
      room.style.blockSize = `${Math.max(0, el.clientHeight - below)}px`
    }
    let fromBottom = 0
    let firstMessage: Element | null = null
    let mounted = false
    // A prepend (the first message changed, the old one still there): keep the reading place.
    const keepPlace = () => {
      const first = el.querySelector('[data-part="message"]')
      const before = firstMessage
      firstMessage = first
      if (before && first && before !== first && before.isConnected) {
        root.stick.current?.restore(fromBottom)
      }
      fromBottom = el.scrollHeight - el.scrollTop
    }
    afterNextRender(() => {
      mounted = true
      root.viewport.current = el
      const threshold = root.bottomThreshold()
      const report = () => root.atBottom.set(atBottom(el, threshold))
      const controller = stickToBottom(el, this.content().nativeElement, {
        threshold,
        onUserScroll: (fact) => root.send({ type: "SCROLLED", ...fact }),
        onEscape: () => root.send({ type: "ESCAPE" }),
        following: () => root.state().state === "following" && root.state().anchor === "bottom",
        // The top layout never follows: growth that leaves the bottom is a fact to report.
        onResize: () => {
          reserve()
          report()
          if (root.state().state === "following" && !atBottom(el, threshold)) {
            root.send({ type: "SCROLLED", atBottom: false, up: false })
          }
        },
      })
      root.stick.current = controller
      root.turn.current = (b) => {
        const last = articles(el).at(-1)
        if (!last) return
        anchored = last
        reserve()
        controller.scrollChildToTop(last, b)
      }
      // Start at the bottom: a thread opens on its latest message.
      el.scrollTop = el.scrollHeight
      const onScroll = () => {
        fromBottom = el.scrollHeight - el.scrollTop
        report()
      }
      el.addEventListener("scroll", onScroll, { passive: true })
      report()
      keepPlace()
      const stopTop = observeTop(el, this.sentinel().nativeElement, () => {
        if (!root.loadingOlder()) root.loadOlder.emit()
      })
      destroy.onDestroy(() => {
        stopTop()
        el.removeEventListener("scroll", onScroll)
        controller.destroy()
        root.stick.current = null
        root.turn.current = null
      })
    })
    afterEveryRender({
      read: () => {
        if (mounted) keepPlace()
      },
    })
  }
}

/** One message: an `article` named by who wrote it. */
@Directive({ selector: "[rindMessageThreadMessage]", exportAs: "rindMessageThreadMessage" })
export class MessageThreadMessage {
  /** The message's index in the whole thread (0 is the oldest). */
  readonly index = input.required<number>()
  /** Who wrote it: names the article ("You", "Assistant"). */
  readonly from = input.required<MessageFrom>()
  constructor() {
    const root = injectThread("Message")
    const named = injectNamed()
    const { focus, handlers } = injectFocusState()
    bindProps(
      () =>
        joinHandlers(
          root.api().message({ index: this.index(), from: this.from(), named, focus: focus() }),
          handlers,
        ),
      { owns: ["from", "index"] },
    )
  }
}

/** Back to the latest message, shown while the reader is away from it with something new. */
@Directive({
  selector: "[rindMessageThreadJumpToLatest]",
  exportAs: "rindMessageThreadJumpToLatest",
})
export class MessageThreadJumpToLatest {
  constructor() {
    const root = injectThread("JumpToLatest")
    const env = injectEnvironment()
    const named = injectNamed()
    bindProps(() => {
      const api = root.api()
      if (!api.showJump) return absentProps("message-thread", String(api.root()["data-instance"]))
      return joinHandlers(api.jumpToLatest(named), {
        onClick: () => root.send({ type: "JUMP", modality: env.modality.modality() }),
      })
    })
  }
}

/** The Message Thread's parts, for a standalone component's `imports`. */
export const MessageThread = [
  MessageThreadRoot,
  MessageThreadViewport,
  MessageThreadMessage,
  MessageThreadJumpToLatest,
] as const
