// Reasoning parts: wiring only. The machine owns the thinking lifecycle and the disclosure,
// connect every attribute.
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type MessageOverrides,
  partId,
  type ReasoningEvent,
  type ReasoningMessages,
  reasoningConnect,
  reasoningDuration,
  reasoningMachine,
  reasoningMessages,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages, withCapabilities } from "../provider"

/** The disclosure's state, for the template (`#r="rindReasoningRoot"`, `r.state()`). */
export interface ReasoningRenderState {
  readonly open: boolean
  readonly thinking: boolean
  /** Seconds, or null when unknown. */
  readonly duration: number | null
}

type Api = ReturnType<typeof reasoningConnect>

const REASONING = new InjectionToken<ReasoningRoot>("rind-ui.reasoning")

function injectReasoning(part: string): ReasoningRoot {
  const root = inject(REASONING, { optional: true })
  if (!root) throw new Error(`rindReasoning${part} must be inside rindReasoningRoot`)
  return root
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A model's reasoning, open while it thinks and closed after: `<div rindReasoningRoot
 * [thinking]="streaming">` with a Trigger and the Content.
 */
@Directive({
  selector: "[rindReasoningRoot]",
  exportAs: "rindReasoningRoot",
  providers: [{ provide: REASONING, useExisting: forwardRef(() => ReasoningRoot) }],
})
export class ReasoningRoot {
  readonly id = input<string>()
  /** The model is thinking (your runtime's streaming flag for the reasoning). */
  readonly thinking = input.required<boolean, boolean | "">({ transform: booleanAttribute })
  /** Controlled (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Seconds, from your runtime; else measured on the Environment's clock. */
  readonly duration = input<number>()
  /** Milliseconds before the automatic close (default 1000). */
  readonly autoCloseDelay = input<number>()
  /** Announce "Thinking…" and "Thought for N seconds" (default true). */
  readonly announce = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly messages = input<MessageOverrides<ReasoningMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  /** `details.reason`: "auto" (the lifecycle) or "trigger" (the user); `cancel()` vetoes it. */
  readonly openChangeDetails = output<ChangeEvent<boolean, ReasoningEvent>>()
  /** The visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()

  private readonly emit = changeEmitter<boolean, ReasoningEvent>(
    this.openChangeDetails,
    this.openChange,
  )
  /** @internal */
  readonly api: Signal<Api>
  /** @internal */
  readonly send: (event: ReasoningEvent) => void
  /** @internal The Content's element (focus inside it keeps it open). */
  readonly content: { value: Element | null } = { value: null }
  /** The disclosure's state, for the template. */
  readonly state: Signal<ReasoningRenderState>

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    const loc = injectLocale(() => this.locale())
    const messages = injectMessages("reasoning", reasoningMessages, () => this.messages())
    const content = this.content
    const machineProps = () => ({
      id: instance(),
      thinking: this.thinking(),
      open: this.open(),
      defaultOpen: this.defaultOpen(),
      onOpenChange: this.emit,
      duration: this.duration(),
      autoCloseDelay: this.autoCloseDelay(),
      announce: this.announce(),
      messages: messages(),
      lang: loc().locale,
    })
    const { view, send } = injectMachine(
      reasoningMachine,
      machineProps,
      withCapabilities(env, {
        focusInside: () => {
          const el = content.value
          return el?.contains(el.ownerDocument.activeElement) === true
        },
      }),
    )
    this.send = send
    this.state = computed(() => ({
      open: view().values.open,
      thinking: view().state === "thinking",
      duration: reasoningDuration(machineProps(), view().context),
    }))
    this.api = computed(() => {
      const s = this.state()
      return reasoningConnect({
        instance: instance(),
        open: s.open,
        thinking: s.thinking,
        duration: s.duration,
        ids: { content: partId("reasoning", instance(), "content") },
        messages: messages(),
        locale: loc().locale,
      })
    })
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "announce",
          "autoclosedelay",
          "defaultopen",
          "duration",
          "id",
          "locale",
          "messages",
          "open",
          "thinking",
        ],
      },
    )
  }
}

/** Opens and closes the Content: its content, or the label ("Thinking…", "Thought for 4 seconds"). */
@Component({
  selector: "[rindReasoningTrigger]",
  exportAs: "rindReasoningTrigger",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ReasoningTrigger {
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const root = injectReasoning("Trigger")
    const env = injectEnvironment()
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    this.text = () => root.api().label
    bindProps(() =>
      joinHandlers(root.api().trigger({ focused: focused(), modality: modality() }), {
        onClick: () => root.send({ type: "TOGGLE" }),
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // Tracking from mount, so the press that focuses it is already known as a pointer one.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/** The reasoning text, rendered while open (React renders nothing while closed). */
@Directive({ selector: "[rindReasoningContent]", exportAs: "rindReasoningContent" })
export class ReasoningContent {
  constructor() {
    const root = injectReasoning("Content")
    root.content.value = inject(ElementRef).nativeElement
    bindProps(() =>
      root.state().open
        ? root.api().content()
        : absentProps("reasoning", String(root.api().root()["data-instance"])),
    )
  }
}

/** The Reasoning's parts, for a standalone component's `imports`. */
export const Reasoning = [ReasoningRoot, ReasoningTrigger, ReasoningContent] as const
