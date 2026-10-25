// Streaming Message parts: wiring only. The machine owns the reveal and the announcements,
// connect every attribute.
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  Directive,
  forwardRef,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
  ViewEncapsulation,
} from "@angular/core"
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
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

/** The message's state, for the template (`#m="rindStreamingMessageRoot"`, `m.state()`). */
export interface StreamingMessageRenderState {
  readonly state: StreamingMessageState
  /** The displayed text (a prefix of `text` while the reveal catches up). */
  readonly text: string
  readonly busy: boolean
}

const STREAMING = new InjectionToken<StreamingMessageRoot>("rind-ui.streaming-message")

function injectStreaming(part: string): StreamingMessageRoot {
  const root = inject(STREAMING, { optional: true })
  if (!root) throw new Error(`rindStreamingMessage${part} must be inside rindStreamingMessageRoot`)
  return root
}

/**
 * A response revealed as it streams: `<div rindStreamingMessageRoot [text]="text"
 * [status]="status">` with the Content and a Caret.
 */
@Directive({
  selector: "[rindStreamingMessageRoot]",
  exportAs: "rindStreamingMessageRoot",
  providers: [{ provide: STREAMING, useExisting: forwardRef(() => StreamingMessageRoot) }],
})
export class StreamingMessageRoot {
  readonly id = input<string>()
  /** Everything received so far. */
  readonly text = input.required<string>()
  /** The response's status, from your chat runtime. */
  readonly status = input.required<StreamingStatus>()
  /** Reveal bursty chunks evenly (default true); off under reduced motion. */
  readonly smooth = input<boolean | StreamingSmooth>()
  /** What is announced (default "status": the lifecycle only). */
  readonly announce = input<StreamingAnnounce>()
  readonly messages = input<MessageOverrides<StreamingMessageMessages>>()
  /** Default: the provider's locale (sentence splitting). */
  readonly locale = input<string>()

  /** @internal */
  readonly instance: () => string
  /** The message's state, for the template. */
  readonly state: Signal<StreamingMessageRenderState>

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const loc = injectLocale(() => this.locale())
    const messages = injectMessages("streaming-message", streamingMessageMessages, () =>
      this.messages(),
    )
    const machineProps = () => ({
      id: instance(),
      text: this.text(),
      status: this.status(),
      smooth: this.smooth(),
      announce: this.announce(),
      messages: messages(),
      lang: loc().locale,
    })
    const { view, send } = injectMachine(streamingMessageMachine, machineProps, env)
    const api = () =>
      streamingMessageConnect({
        instance: instance(),
        state: view().state as StreamingMessageState,
        plain: false,
      })
    this.state = computed(() => {
      const s = view().state as StreamingMessageState
      return { state: s, text: displayedText(s, machineProps(), view().context), busy: api().busy }
    })
    bindProps(() => ({ ...api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }), {
      owns: ["announce", "id", "locale", "messages", "smooth", "status", "text"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // Read after hydration, then followed: the server and the first client render agree.
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
      destroy.onDestroy(
        env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
      )
    })
  }
}

const CONTENT = new InjectionToken<StreamingMessageContent>("rind-ui.streaming-message-content")

/** Marks the Content's own text (rendered only when the Content has no content of its own). */
@Directive({ selector: "[rindStreamingPlainText]" })
export class StreamingPlainText {
  constructor() {
    const content = inject(CONTENT)
    content.plain.set(true)
    inject(DestroyRef).onDestroy(() => content.plain.set(false))
  }
}

/**
 * The displayed text, plain (`<div rindStreamingMessageContent></div>`); or your renderer
 * (markdown) inside it, reading `m.state().text`.
 */
@Component({
  selector: "[rindStreamingMessageContent]",
  exportAs: "rindStreamingMessageContent",
  imports: [StreamingPlainText],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: CONTENT, useExisting: forwardRef(() => StreamingMessageContent) }],
  template: `<ng-content><ng-container rindStreamingPlainText>{{ text() }}</ng-container></ng-content>`,
})
export class StreamingMessageContent {
  /** @internal The text is the Content's own. */
  readonly plain = signal(false)
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const root = injectStreaming("Content")
    this.text = () => root.state().text
    bindProps(() =>
      streamingMessageConnect({
        instance: root.instance(),
        state: root.state().state,
        plain: this.plain(),
      }).content(),
    )
  }
}

/** Shown while the message streams (React renders nothing otherwise). */
@Directive({ selector: "[rindStreamingMessageCaret]", exportAs: "rindStreamingMessageCaret" })
export class StreamingMessageCaret {
  constructor() {
    const root = injectStreaming("Caret")
    bindProps(() => {
      const s = root.state()
      return s.busy
        ? streamingMessageConnect({
            instance: root.instance(),
            state: s.state,
            plain: false,
          }).caret()
        : absentProps("streaming-message", root.instance())
    })
  }
}

/** The Streaming Message's parts, for a standalone component's `imports`. */
export const StreamingMessage = [
  StreamingMessageRoot,
  StreamingMessageContent,
  StreamingMessageCaret,
] as const
