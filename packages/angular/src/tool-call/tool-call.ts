// Tool Call (add-tool-call): a disclosure Header (the tool and its status in words) over the
// details, and an Approval whose Approve and Deny exist only with `decision` listened to. The
// machine owns the disclosure, the decision attempt, the focus after it and the duration.
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
  type ApprovalState,
  announcerCapability,
  focusSafely,
  type MessageOverrides,
  type PartProps,
  partId,
  type ToolCallButtonInput,
  type ToolCallDecision,
  type ToolCallEvent,
  type ToolCallMessages,
  type ToolCallStatus,
  toolCallConnect,
  toolCallMachine,
  toolCallMessages,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages, withCapabilities } from "../provider"

/** The call's state, for the template (`#t="rindToolCallRoot"`, `t.state()`). */
export interface ToolCallRenderState {
  readonly status: ToolCallStatus
  readonly open: boolean
  readonly approval: ApprovalState
  readonly decision: "approved" | "denied" | null
  /** Seconds: the prop, else the measured time; null when unknown. */
  readonly duration: number | null
}

const TOOL_CALL = new InjectionToken<ToolCallRoot>("rind-ui.tool-call")

function injectToolCall(part: string): ToolCallRoot {
  const root = inject(TOOL_CALL, { optional: true })
  if (!root) throw new Error(`rindToolCall${part} must be inside rindToolCallRoot`)
  return root
}

/**
 * One tool call: `<div rindToolCallRoot callId="c1" name="search" [status]="status">` with a
 * Header (Name, Status, Duration) and a Content holding Input, Output, Error and Approval.
 */
@Directive({
  selector: "[rindToolCallRoot]",
  exportAs: "rindToolCallRoot",
  providers: [{ provide: TOOL_CALL, useExisting: forwardRef(() => ToolCallRoot) }],
})
export class ToolCallRoot {
  /** Required. The call's identity, sent with the decision (`id` stays the element's). */
  readonly callId = input.required<string>()
  /** Required. The tool's name. */
  readonly name = input.required<string>()
  /** Required. Map it from your runtime. */
  readonly status = input.required<ToolCallStatus>()
  /** Controlled open state (`[(open)]`). */
  readonly open = input<boolean | undefined>(undefined)
  /** Uncontrolled open state. */
  readonly defaultOpen = input(false, { transform: booleanAttribute })
  /**
   * The human's decision; without it no buttons are rendered. An input, not an output: the
   * machine awaits the promise it returns (the buttons stay busy until it settles).
   */
  readonly onDecision = input<(decision: ToolCallDecision) => void | Promise<void>>()
  /** Focus Approve when a request arrives (only when the user expects it). Default "none". */
  readonly focusOnRequest = input<"none" | "approval">()
  /** Announce a request for approval and a failure. Default "polite". */
  readonly announce = input<"off" | "polite">()
  /** A high-risk request (the theme uses the danger tone). Default "normal". */
  readonly risk = input<"normal" | "high">("normal")
  /** Seconds; else measured from the first live status. */
  readonly duration = input<number>()
  readonly messages = input<MessageOverrides<ToolCallMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  /** The Header was pressed. */
  readonly openChange = output<boolean>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof toolCallConnect>>
  /** @internal */
  readonly send: (event: ToolCallEvent) => void
  readonly state: Signal<ToolCallRenderState>
  /** @internal */
  approvalEl: HTMLElement | null = null
  /** @internal */
  receiptEl: HTMLElement | null = null
  /** @internal */
  approveEl: HTMLElement | null = null

  constructor() {
    // The parts' ids come from a generated root id: `callId` is the call's.
    const instance = injectRootId(() => undefined)
    const env = injectEnvironment(announcerCapability)
    const messages = injectMessages("tool-call", toolCallMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    const { view, send } = injectMachine(
      toolCallMachine,
      () => ({
        id: this.callId(),
        name: this.name(),
        status: this.status(),
        ...(this.open() === undefined ? {} : { open: this.open() }),
        defaultOpen: this.defaultOpen(),
        onOpenChange: (o: boolean) => this.openChange.emit(o),
        ...(this.onDecision() === undefined
          ? {}
          : { onDecision: (d: ToolCallDecision) => this.onDecision()?.(d) }),
        focusOnRequest: this.focusOnRequest(),
        announce: this.announce(),
        duration: this.duration(),
        messages: messages(),
        lang: locale().locale,
      }),
      withCapabilities(env, {
        focusInside: () => {
          const el = this.approvalEl
          return el?.contains(el.ownerDocument.activeElement) === true
        },
        // After the render that shows the Receipt.
        focusReceipt: () =>
          queueMicrotask(() => {
            if (this.receiptEl)
              void focusSafely(this.receiptEl, env, "programmatic", env.modality.modality())
          }),
        focusApprove: () =>
          queueMicrotask(() => {
            if (this.approveEl) void focusSafely(this.approveEl, env, "programmatic", "keyboard")
          }),
      }),
    )
    this.send = send
    const seconds = () => this.duration() ?? view().context.measured
    this.api = computed(() =>
      toolCallConnect(
        {
          instance: instance(),
          name: this.name(),
          status: this.status(),
          open: view().values.open === true,
          approval: view().context.approval,
          decision: view().context.decision,
          duration: seconds(),
          risk: this.risk(),
          decides: this.onDecision() !== undefined,
          messages: messages(),
          ids: {
            header: partId("tool-call", instance(), "header"),
            content: partId("tool-call", instance(), "content"),
          },
        },
        env,
      ),
    )
    this.state = computed(() => ({
      status: this.status(),
      open: view().values.open === true,
      approval: view().context.approval,
      decision: view().context.decision,
      duration: seconds(),
    }))
    bindProps(() => this.api().root(), {
      owns: [
        "announce",
        "callid",
        "defaultopen",
        "duration",
        "focusonrequest",
        "locale",
        "messages",
        "name",
        "ondecision",
        "open",
        "risk",
        "status",
      ],
    })
  }
}

/** A button part: modality-aware focus, Enter and Space on a non-button host. */
function injectButton(
  part: string,
  own: (api: ReturnType<typeof toolCallConnect>, b: ToolCallButtonInput) => PartProps,
  press: ToolCallEvent,
) {
  const root = injectToolCall(part)
  const el: HTMLElement = inject(ElementRef).nativeElement
  const tag = el.tagName.toLowerCase()
  const native = tag === "button" || tag === "input"
  const env = injectEnvironment()
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    // Tracks the modality from the first render, so the first keyboard focus is visible.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  bindProps(() =>
    joinHandlers(own(root.api(), { tag, focused: focused(), modality: modality() }), {
      onClick: () => root.send(press),
      onKeyDown: (e: KeyboardEvent) => {
        if (native || e.repeat) return
        if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
        if (e.key === " ") e.preventDefault()
      },
      onKeyUp: (e: KeyboardEvent) => {
        if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
      },
      onFocusIn: () => focused.set(true),
      onFocusOut: () => focused.set(false),
    }),
  )
  return { root, el }
}

/** Opens and closes the details; named by the tool and the status in words. */
@Directive({ selector: "[rindToolCallHeader]", exportAs: "rindToolCallHeader" })
export class ToolCallHeader {
  constructor() {
    injectButton("Header", (api, b) => api.header(b), { type: "TOGGLE" })
  }
}

/**
 * Sends `onDecision({ id, approved: true })`; one decision, focusable while submitting.
 * Rendered (not `hidden`) only with `onDecision`: put it under `@if (t.decides())`.
 */
@Component({
  selector: "[rindToolCallApprove]",
  exportAs: "rindToolCallApprove",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ToolCallApprove {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const { root, el } = injectButton("Approve", (api, b) => api.approve(b), { type: "APPROVE" })
    root.approveEl = el
    bindProps(() => ({ hidden: root.api().decides ? undefined : "" }))
    this.text = computed(() => root.api().approveText)
  }
}

/** Sends `onDecision({ id, approved: false })`; `hidden` without `onDecision`. */
@Component({
  selector: "[rindToolCallDeny]",
  exportAs: "rindToolCallDeny",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ToolCallDeny {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const { root } = injectButton("Deny", (api, b) => api.deny(b), { type: "DENY" })
    bindProps(() => ({ hidden: root.api().decides ? undefined : "" }))
    this.text = computed(() => root.api().denyText)
  }
}

/** A part with only its attributes (consumer content). */
function plain(part: string, own: (api: ReturnType<typeof toolCallConnect>) => PartProps) {
  const root = injectToolCall(part)
  bindProps(() => own(root.api()))
  return root
}

/** The tool's name (its content replaces it). */
@Component({
  selector: "[rindToolCallName]",
  exportAs: "rindToolCallName",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ToolCallName {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = plain("Name", (api) => api.name())
    this.text = computed(() => root.name())
  }
}

/** The status in words; `aria-hidden` (it is in the Header's name). */
@Component({
  selector: "[rindToolCallStatus]",
  exportAs: "rindToolCallStatus",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ToolCallStatusPart {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = plain("Status", (api) => api.status())
    this.text = computed(() => root.api().statusText)
  }
}

/** How long it ran. */
@Component({
  selector: "[rindToolCallDuration]",
  exportAs: "rindToolCallDuration",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ToolCallDuration {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = plain("Duration", (api) => api.duration())
    this.text = computed(() => root.api().durationText)
  }
}

/** The details region (`hidden` while closed): Input, Output, Error, Approval. */
@Directive({ selector: "[rindToolCallContent]", exportAs: "rindToolCallContent" })
export class ToolCallContent {
  constructor() {
    plain("Content", (api) => api.content())
  }
}

/** The arguments (a Code Block or a JSON Tree View). */
@Directive({ selector: "[rindToolCallInput]", exportAs: "rindToolCallInput" })
export class ToolCallInput {
  constructor() {
    plain("Input", (api) => api.input())
  }
}

/** The result. */
@Directive({ selector: "[rindToolCallOutput]", exportAs: "rindToolCallOutput" })
export class ToolCallOutput {
  constructor() {
    plain("Output", (api) => api.output())
  }
}

/** The error. */
@Directive({ selector: "[rindToolCallError]", exportAs: "rindToolCallError" })
export class ToolCallError {
  constructor() {
    plain("Error", (api) => api.error())
  }
}

/** A group asking for a decision; shows its outcome after. Hidden until one is asked. */
@Directive({ selector: "[rindToolCallApproval]", exportAs: "rindToolCallApproval" })
export class ToolCallApproval {
  constructor() {
    const root = plain("Approval", (api) => ({
      ...api.approval(),
      hidden: api.showsApproval ? undefined : "",
    }))
    root.approvalEl = inject(ElementRef).nativeElement
  }
}

/** What is asked. */
@Directive({ selector: "[rindToolCallApprovalTitle]", exportAs: "rindToolCallApprovalTitle" })
export class ToolCallApprovalTitle {
  constructor() {
    plain("ApprovalTitle", (api) => api.approvalTitle())
  }
}

/** Why, or what it will do. */
@Directive({
  selector: "[rindToolCallApprovalDescription]",
  exportAs: "rindToolCallApprovalDescription",
})
export class ToolCallApprovalDescription {
  constructor() {
    plain("ApprovalDescription", (api) => api.approvalDescription())
  }
}

/** `role="status"`: "Approved", "Denied" or "Request expired"; takes the focus after a decision. */
@Component({
  selector: "[rindToolCallReceipt]",
  exportAs: "rindToolCallReceipt",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ToolCallReceipt {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = plain("Receipt", (api) => api.receipt())
    root.receiptEl = inject(ElementRef).nativeElement
    this.text = computed(() => root.api().receiptText)
  }
}

/** The Tool Call's parts, for a standalone component's `imports`. */
export const ToolCall = [
  ToolCallRoot,
  ToolCallHeader,
  ToolCallName,
  ToolCallStatusPart,
  ToolCallDuration,
  ToolCallContent,
  ToolCallInput,
  ToolCallOutput,
  ToolCallError,
  ToolCallApproval,
  ToolCallApprovalTitle,
  ToolCallApprovalDescription,
  ToolCallApprove,
  ToolCallDeny,
  ToolCallReceipt,
] as const
