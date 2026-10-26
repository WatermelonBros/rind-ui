// Prompt Input (prompt-input spec): Root owns the machine and is the form; it renders the
// Field's element (standalone, or joined to an enclosing Field), the hidden file inputs and the
// attachments summary; every other part is wiring. Derived state and keys live in core's
// connect.

import { NgTemplateOutlet } from "@angular/common"
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  TemplateRef,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  announcerCapability,
  autosize as attachAutosize,
  type FieldMessages,
  type FileRejection,
  focusSafely,
  type MessageOverrides,
  mergeFieldProps,
  type PartProps,
  type PromptAttachment,
  type PromptAttachmentsReason,
  type PromptInputMessages,
  type PromptInputState,
  type PromptInputStatus,
  type PromptMessage,
  type PromptSubmitDetails,
  type PromptSubmitKey,
  type PromptValueReason,
  promptAttachmentsReason,
  promptInputConnect,
  promptInputIds,
  promptInputMachine,
  promptInputMessages,
  promptValueReason,
  replaceText,
  syncFileInput,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { FIELD_CONTROL, FIELD_HOST, type FieldHost, injectFieldControl } from "../field/context"
import { FieldRoot } from "../field/field"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment } from "../provider"
import { RindProps } from "../rind-props"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

interface CountState {
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

/** The Prompt Input's state and actions (`#p="rindPromptInputRoot"`, `p.control`). */
export interface PromptInputControl {
  /** The machine state. */
  readonly state: PromptInputState
  /** The draft. */
  readonly value: string
  /** The attachments. */
  readonly attachments: readonly PromptAttachment[]
  /** Sends the draft, through the same checks as Enter. */
  submit(): void
  /** Stops the reply (as Submit does while busy). */
  stop(): void
  /** Replaces the draft (reason `api`); ignored while an IME composition is open. */
  setValue(value: string): void
  /** Inserts text at the caret (or over the selection); ignored while composing. */
  insertText(text: string): void
  /** Focuses the Textarea. */
  focus(): void
  /** Opens the file chooser. */
  openFilePicker(): void
  /** Adds files, through the same checks as a drop. */
  addFiles(files: readonly File[]): void
}

const EMPTY: readonly PromptAttachment[] = []

const PROMPT = new InjectionToken<PromptInputRoot>("rind-ui.prompt-input")

function injectPrompt(part: string): PromptInputRoot {
  const root = inject(PROMPT, { optional: true })
  if (!root) throw new Error(`rindPromptInput${part} must be inside rindPromptInputRoot`)
  return root
}

/** The Prompt Input's state and actions, from inside its Root. Call it in an injection context. */
export function injectPromptInput(): PromptInputControl {
  return injectPrompt("injectPromptInput").control
}

/**
 * A chat prompt: `<form rindPromptInputRoot [submitHandler]="send">` with a Label, a Textarea,
 * the Attachments, an AttachTrigger and a Submit.
 */
@Component({
  selector: "form[rindPromptInputRoot]",
  exportAs: "rindPromptInputRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: FieldRoot,
      inputs: ["disabled", "readonly", "errors", "messages: fieldMessages"],
    },
  ],
  providers: [
    { provide: PROMPT, useExisting: forwardRef(() => PromptInputRoot) },
    {
      provide: FIELD_HOST,
      // The Field is the inner element (the Root sets `inner` once it can resolve it).
      useFactory: (): FieldHost => ({
        scope: "prompt-input",
        rootPart: "field",
        inner: () => null,
      }),
    },
  ],
  template: `<div #field [rindProps]="fieldProps()"><ng-content /></div><span [rindProps]="summary()">{{ api().summaryText }}</span><input [rindProps]="api().picker()" /><input [rindProps]="api().files()" />`,
})
export class PromptInputRoot {
  readonly id = input<string>()
  /** The draft (controlled, `[(value)]`). The machine's own writes are then proposals. */
  readonly value = input<string>()
  /** The initial draft (uncontrolled: the Textarea owns its value, writes are undoable). */
  readonly defaultValue = input("")
  /** The attachments (controlled, `[(attachments)]`). */
  readonly attachments = input<readonly PromptAttachment[]>()
  /** The initial attachments (uncontrolled). Default none. */
  readonly defaultAttachments = input<readonly PromptAttachment[]>()
  /**
   * Sends the prompt: called once per send with the draft and attachments as they were; both
   * clear at once. Return a promise to stay `submitting` until it settles; a rejection
   * restores the prompt into an empty draft. A synchronous throw fails the send.
   */
  readonly submitHandler =
    input<(message: PromptMessage, details: PromptSubmitDetails) => unknown>()
  /**
   * Your request's progress: `submitting` and `streaming` turn Submit into Stop, `idle` ends
   * it, `error` fails the send.
   */
  readonly status = input<PromptInputStatus>()
  /**
   * What sends from the Textarea: `"enter"` (Shift+Enter is a newline), `"mod+enter"`, or
   * `"none"` (only Submit). Mod+Enter always sends; with a coarse primary pointer Enter is a
   * newline. Default `"enter"`.
   */
  readonly submitKey = input<PromptSubmitKey>("enter")
  /** Past prompts, newest last: ArrowUp in an empty draft recalls them. */
  readonly history = input<readonly string[]>()
  /** Accepted files, as `<input accept>`: MIME types, `type/*` and `.ext`. */
  readonly accept = input<string>()
  /** The file chooser picks several files. Default `true`. */
  readonly multiple = input(true, { transform: booleanAttribute })
  /** The most attachments at once; more are refused. */
  readonly maxFiles = input<number>()
  /** The largest file, in bytes; larger ones are refused. */
  readonly maxFileSize = input<number>()
  /** The Textarea's form name. Default `"message"`. */
  readonly name = input("message")
  /** The attached files' form name. Default `"files"`. */
  readonly filesName = input("files")
  /** The Field is invalid (also while over a CharacterCount's max). */
  readonly invalid = input(false, { transform: booleanAttribute })
  /** Replaces any string that reaches assistive technology. */
  readonly messages = input<Partial<PromptInputMessages>>()
  /** The Field's own strings (the Field's `messages`). */
  readonly fieldMessages = input<MessageOverrides<FieldMessages>>()
  /** Submit was pressed while a reply is on its way. */
  readonly stop = output<void>()
  /** Files refused by `accept`, `maxFiles` or `maxFileSize`, with the reason of each. */
  readonly reject = output<readonly FileRejection[]>()
  /** Every draft change: typing, the clear on send, a restore after a failure, a recall. */
  readonly valueChangeDetails = output<{
    value: string
    details: { readonly reason: PromptValueReason }
  }>()
  /** The draft, for `[(value)]`. */
  readonly valueChange = output<string>()
  /** Every attachments change: added files, removals, the clear on send, a restore. */
  readonly attachmentsChangeDetails = output<{
    value: readonly PromptAttachment[]
    details: { readonly reason: PromptAttachmentsReason }
  }>()
  /** The attachments, for `[(attachments)]`. */
  readonly attachmentsChange = output<readonly PromptAttachment[]>()

  /** @internal */
  readonly field = inject(FieldRoot, { self: true })
  /** @internal */
  readonly api: Signal<ReturnType<typeof promptInputConnect>>
  /** @internal */
  readonly ids: Signal<ReturnType<typeof promptInputIds>>
  /** @internal */
  readonly draft: () => string
  /** @internal */
  readonly list: () => readonly PromptAttachment[]
  /** @internal */
  readonly controlled = () => this.value() !== undefined
  /** @internal Set while the machine writes the draft itself (a send, history, restore). */
  takeReason: () => unknown = () => undefined
  /** @internal */
  readonly disabledState: () => boolean
  /** @internal */
  readonly readOnlyState: () => boolean
  /** @internal */
  readonly countState = signal<CountState | null>(null)
  /** @internal */
  readonly textareaId: ReturnType<typeof signal<string>>
  /** @internal */
  readonly textarea: { current: HTMLTextAreaElement | null } = { current: null }
  /** @internal */
  readonly mounted = { textareas: 0, submits: 0 }
  /** The state and the actions a suggestion or a menu uses. */
  readonly control: PromptInputControl
  /** @internal */
  protected readonly fieldProps: () => PartProps
  /** @internal */
  protected readonly summary: Signal<PartProps>
  private readonly fieldEl = viewChild<ElementRef<HTMLElement>>("field")

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    this.ids = computed(() => promptInputIds(instance()))
    const enclosing = inject(FIELD_CONTROL, { optional: true, skipSelf: true }) ?? null
    const fieldsetDisabled = injectFieldsetDisabled()
    const disabled = () =>
      this.field.disabled() || enclosing?.().state.disabled === true || fieldsetDisabled()
    const readOnly = () => this.field.readonly() || enclosing?.().state.readOnly === true
    this.disabledState = disabled
    this.readOnlyState = readOnly
    const messages = computed(() => ({ ...promptInputMessages, ...this.messages() }))
    this.textareaId = signal("")
    const focusedButton = signal<"submit" | "attach-trigger" | null>(null)
    const textarea = this.textarea
    let reason: PromptValueReason | undefined
    this.takeReason = () => reason
    let thrown: { readonly error: unknown } | null = null
    const nativeAction = inject(new HostAttributeToken("action"), { optional: true }) !== null
    const machineProps = () => ({
      ...(this.controlled() ? { value: this.value() ?? "" } : {}),
      defaultValue: this.defaultValue(),
      ...(this.attachments() !== undefined ? { attachments: this.attachments() } : {}),
      defaultAttachments: this.defaultAttachments() ?? EMPTY,
      status: this.status(),
      disabled: disabled(),
      readOnly: readOnly(),
      history: this.history(),
      accept: this.accept(),
      maxFiles: this.maxFiles(),
      maxFileSize: this.maxFileSize(),
      limit: this.countState()?.max,
      count: this.countState()?.count,
      id: instance(),
      locale: env.locale.locale(),
      messages: messages(),
      onSubmit: (m: PromptMessage, d: PromptSubmitDetails) => untracked(this.submitHandler)?.(m, d),
      onStop: () => this.stop.emit(),
      onReject: (r: readonly FileRejection[]) => this.reject.emit(r),
      onThrow: (error: unknown) => {
        thrown = { error }
      },
      // Uncontrolled: an undoable edit of the Textarea; its `input` event brings the value back.
      writeDraft: this.controlled()
        ? undefined
        : (text: string, why: PromptValueReason) => {
            const el = textarea.current
            if (!el) return false
            reason = why
            try {
              return replaceText(el, text)
            } finally {
              reason = undefined
            }
          },
      onValueChange: (v: string, d: { event: { type: string } }) => {
        this.valueChangeDetails.emit({ value: v, details: { reason: promptValueReason(d.event) } })
        this.valueChange.emit(v)
      },
      onAttachmentsChange: (v: readonly PromptAttachment[], d: { event: { type: string } }) => {
        this.attachmentsChangeDetails.emit({
          value: v,
          details: { reason: promptAttachmentsReason(d.event) },
        })
        this.attachmentsChange.emit(v)
      },
    })
    // Sound: `machineProps` is the machine's props (the adapter's own split off above).
    const { view, send } = injectMachine(promptInputMachine, machineProps as never, env)
    this.draft = () => (view().values.value as string | undefined) ?? ""
    this.list = () =>
      (view().values.attachments as readonly PromptAttachment[] | undefined) ?? EMPTY
    const modality = injectModality(
      env.modality,
      () => view().context.focused || focusedButton() !== null,
    )
    // Server and hydration: a fine pointer; the client's own after hydration.
    const touchPrimary = signal(false)
    this.api = computed(() =>
      promptInputConnect(
        {
          instance: instance(),
          state: view().state as PromptInputState,
          context: view().context,
          value: this.draft(),
          attachments: this.list(),
          props: {
            disabled: disabled(),
            readOnly: readOnly(),
            history: this.history(),
            limit: this.countState()?.max,
            count: this.countState()?.count,
          },
          submitKey: this.submitKey(),
          touchPrimary: touchPrimary(),
          accept: this.accept(),
          multiple: this.multiple(),
          name: this.name(),
          filesName: this.filesName(),
          textareaId: this.textareaId() || this.ids().textarea,
          countMounted: this.countState() !== null,
          modality: modality(),
          dir: env.locale.dir(),
          locale: env.locale.locale(),
          messages: messages(),
          focusedButton: focusedButton(),
          setFocusedButton: (b) => focusedButton.set(b),
          nativeAction,
          takeThrown: () => {
            const t = thrown
            thrown = null
            return t
          },
          takeReason: () => reason,
          send,
        },
        env,
      ),
    )
    const host = inject(FIELD_HOST, { self: true })
    host.id = () => `${instance()}-field`
    host.inner = () => this.fieldEl()?.nativeElement ?? null
    // Over the count's max, from the first change detection on: the Field reads `invalid` while
    // the parts are created, before the Root's inputs are set (the machine must not start then).
    const overLimit = signal(false)
    effect(() => {
      const over = this.api().derived.overLimit
      untracked(() => overLimit.set(over))
    })
    host.invalid = () => this.invalid() || overLimit()
    this.fieldProps = () => this.field.rootProps()
    this.summary = computed(() => {
      const { children: _summary, ...own } = this.api().chipsSummary()
      return own
    })
    this.control = {
      get state() {
        return view().state as PromptInputState
      },
      get value() {
        return untracked(() => (view().values.value as string | undefined) ?? "")
      },
      get attachments() {
        return untracked(
          () => (view().values.attachments as readonly PromptAttachment[] | undefined) ?? EMPTY,
        )
      },
      submit: () => untracked(this.api).control.submit(),
      stop: () => untracked(this.api).control.stop(),
      setValue: (v) => untracked(this.api).control.setValue(v),
      insertText: (t) => untracked(this.api).control.insertText(t),
      focus: () => untracked(this.api).control.focus(),
      openFilePicker: () => untracked(this.api).control.openFilePicker(),
      addFiles: (f) => untracked(this.api).control.addFiles(f),
    }
    bindProps(() => this.api().root(), {
      owns: [
        "accept",
        "attachments",
        "defaultattachments",
        "defaultvalue",
        "disabled",
        "errors",
        "fieldmessages",
        "filesname",
        "history",
        "id",
        "invalid",
        "maxfiles",
        "maxfilesize",
        "messages",
        "multiple",
        "name",
        "readonly",
        "status",
        "submithandler",
        "submitkey",
        "value",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      // The modality tracker must see the pointerdown that comes before a focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      touchPrimary.set(env.pointer?.coarse() ?? false)
      const off = env.pointer?.subscribeCoarse(() =>
        touchPrimary.set(env.pointer?.coarse() ?? false),
      )
      if (off) destroy.onDestroy(off)
      // Exactly one Textarea and one Submit (development error otherwise).
      if (process.env.NODE_ENV === "production") return
      if (this.mounted.textareas !== 1 || this.mounted.submits !== 1) {
        console.error(
          `[rind-ui] prompt-input: renders ${this.mounted.textareas} Textarea and ${this.mounted.submits} Submit parts; exactly one of each is required.`,
        )
      }
    })
    // The carrier input holds the attached files, so the form's FormData carries them.
    let synced: readonly PromptAttachment[] | null = null
    afterEveryRender({
      write: () => {
        const list = untracked(this.list)
        if (list === synced) return
        synced = list
        const el = env.dom.getById(untracked(this.ids).files)
        if (!(el instanceof HTMLInputElement)) return
        const files = list.flatMap((a) => (a.file ? [a.file] : []))
        if (files.length > 0 || (el.files?.length ?? 0) > 0) syncFileInput(el, files)
      },
    })
  }
}

/** Counts a part for the "exactly one" development check. */
function injectCounted(root: PromptInputRoot, key: "textareas" | "submits") {
  if (inject(PLATFORM_ID) !== "browser") return
  root.mounted[key] += 1
  inject(DestroyRef).onDestroy(() => {
    root.mounted[key] -= 1
  })
}

/** The draft: `<textarea rindPromptInputTextarea>`; it grows with its content by default. */
@Directive({ selector: "textarea[rindPromptInputTextarea]", exportAs: "rindPromptInputTextarea" })
export class PromptInputTextarea {
  readonly id = input<string>()
  /** Grows with the content (`field-sizing: content`, a measured fallback). Default `true`. */
  readonly autosize = input(true, { transform: booleanAttribute })

  constructor() {
    const root = injectPrompt("Textarea")
    injectCounted(root, "textareas")
    const env = injectEnvironment()
    const binding = injectFieldControl()
    const el: HTMLTextAreaElement = inject(ElementRef).nativeElement
    const attr = (name: string) =>
      inject(new HostAttributeToken(name), { optional: true }) ?? undefined
    const describedBy = attr("aria-describedby")
    const ariaLabel = attr("aria-label")
    const ariaLabelledBy = attr("aria-labelledby")
    // The Field's control id first: its Label is `for` it from the first render.
    const controlId = () => this.id() ?? binding?.().controlId ?? root.ids().textarea
    // After the first render, as React's layout effect: the server HTML has the Root's id.
    if (inject(PLATFORM_ID) === "browser") {
      const ready = signal(false)
      afterNextRender(() => ready.set(true))
      effect(() => {
        if (!ready()) return
        const id = controlId()
        untracked(() => root.textareaId.set(id))
      })
    }
    root.textarea.current = el
    bindProps(
      () => {
        const field = mergeFieldProps(
          {
            role: "textbox",
            labelable: true,
            disabled: root.disabledState(),
            readOnly: root.readOnlyState(),
            invalid: root.api().derived.overLimit,
            name: root.name(),
            consumerDescribedBy: describedBy,
            ariaLabel,
            ariaLabelledBy,
          },
          binding?.() ?? null,
        )
        return joinHandlers(
          {
            ...root.api().textarea(field),
            ...(root.controlled()
              ? { value: root.draft() }
              : { defaultValue: untracked(root.defaultValue) }),
          },
          {
            // The Field validates on the control's changes.
            onInput: (e: InputEvent) =>
              binding?.().report({
                type: "change",
                value: (e.target as HTMLTextAreaElement).value,
                // The machine's own writes (a send clearing the draft) are not the user's.
                user: root.takeReason() === undefined,
                composing: e.isComposing === true,
              }),
          },
        )
      },
      { owns: ["aria-describedby", "aria-label", "aria-labelledby", "autosize"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    destroy.onDestroy(() => {
      if (root.textarea.current === el) root.textarea.current = null
    })
    let handle: ReturnType<typeof attachAutosize> | null = null
    afterNextRender(() => {
      let unregister: (() => void) | undefined
      let registered: string | undefined
      const register = () => {
        const id = untracked(controlId)
        if (id === registered) return
        registered = id
        unregister?.()
        unregister = binding?.().register(
          {
            id,
            labelable: true,
            focus: (modality) => void focusSafely(el, env, "programmatic", modality),
            validityElement: () => el,
            value: () => el.value,
          },
          id,
        )
      }
      register()
      if (untracked(this.autosize)) {
        handle = attachAutosize(el, env)
        destroy.onDestroy(() => handle?.dispose())
      }
      destroy.onDestroy(() => unregister?.())
      // Development: the placeholder is never a name. Checked once the Field's Label settled.
      if (process.env.NODE_ENV !== "production") {
        const frame = env.scheduler.requestAnimationFrame(() => {
          const named =
            (el.labels?.length ?? 0) > 0 ||
            el.hasAttribute("aria-label") ||
            el.hasAttribute("aria-labelledby")
          if (!named) {
            console.warn(
              "[rind-ui] prompt-input: the Textarea has no accessible name: render a rindPromptInputLabel or pass aria-label (a placeholder is not a name).",
            )
          }
        })
        destroy.onDestroy(() => env.scheduler.cancelAnimationFrame(frame))
      }
    })
    // Every value commit (typing, the clear on send, a restore, a recall) re-measures.
    let measured: string | undefined
    afterEveryRender({
      read: () => {
        const v = untracked(root.draft)
        if (v === measured) return
        measured = v
        handle?.measure()
      },
    })
  }
}

/** Sends the draft, or stops the reply while one is on its way: `<button rindPromptInputSubmit>`. */
@Directive({ selector: "[rindPromptInputSubmit]", exportAs: "rindPromptInputSubmit" })
export class PromptInputSubmit {
  constructor() {
    const root = injectPrompt("Submit")
    injectCounted(root, "submits")
    bindProps(() => root.api().submit())
  }
}

/** Opens the file chooser: `<button rindPromptInputAttachTrigger>`. */
@Directive({ selector: "[rindPromptInputAttachTrigger]", exportAs: "rindPromptInputAttachTrigger" })
export class PromptInputAttachTrigger {
  constructor() {
    const root = injectPrompt("AttachTrigger")
    bindProps(() => root.api().attachTrigger())
  }
}

const CHIP = new InjectionToken<PromptInputAttachment>("rind-ui.prompt-input-chip")

function injectChip(part: string): PromptInputAttachment {
  const chip = inject(CHIP, { optional: true })
  if (!chip) throw new Error(`rindPromptInput${part} must be inside rindPromptInputAttachment`)
  return chip
}

/** One attachment's chip: `<span rindPromptInputAttachment [attachment]="a">`. */
@Directive({
  selector: "[rindPromptInputAttachment]",
  exportAs: "rindPromptInputAttachment",
  providers: [{ provide: CHIP, useExisting: forwardRef(() => PromptInputAttachment) }],
})
export class PromptInputAttachment {
  readonly attachment = input.required<PromptAttachment>()
  constructor() {
    const root = injectPrompt("Attachment")
    bindProps(() => root.api().chip(this.attachment().id), { owns: ["attachment"] })
  }
}

/** The attachment's name: its content, or the file name. */
@Component({
  selector: "[rindPromptInputAttachmentName]",
  exportAs: "rindPromptInputAttachmentName",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ chip.attachment().name }}</ng-content>",
})
export class PromptInputAttachmentName {
  /** @internal */
  protected readonly chip = injectChip("AttachmentName")
  constructor() {
    const root = injectPrompt("AttachmentName")
    bindProps(() => root.api().chipText())
  }
}

/** Removes the attachment: its content, or a "×". */
@Component({
  selector: "[rindPromptInputAttachmentRemove]",
  exportAs: "rindPromptInputAttachmentRemove",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content><span aria-hidden="true">×</span></ng-content>`,
})
export class PromptInputAttachmentRemove {
  constructor() {
    const root = injectPrompt("AttachmentRemove")
    const chip = injectChip("AttachmentRemove")
    bindProps(() => root.api().chipRemove(chip.attachment().id))
  }
}

/**
 * The attachments toolbar: one chip per file, from your template
 * (`<ng-template let-a><span rindPromptInputAttachment [attachment]="a">…`) or the default
 * (its name and its remove button). React renders nothing while it is empty.
 */
@Component({
  selector: "[rindPromptInputAttachments]",
  exportAs: "rindPromptInputAttachments",
  imports: [
    NgTemplateOutlet,
    PromptInputAttachment,
    PromptInputAttachmentName,
    PromptInputAttachmentRemove,
  ],
  encapsulation: ViewEncapsulation.None,
  template: `@for (a of list(); track a.id) {
    @if (chip(); as t) {
      <ng-container *ngTemplateOutlet="t; context: { $implicit: a }" />
    } @else {
      <span rindPromptInputAttachment [attachment]="a"><span rindPromptInputAttachmentName></span><button rindPromptInputAttachmentRemove></button></span>
    }
  }`,
})
export class PromptInputAttachments {
  /** @internal */
  protected readonly chip = contentChild(TemplateRef<{ $implicit: PromptAttachment }>)
  /** @internal */
  protected readonly list: () => readonly PromptAttachment[]
  constructor() {
    const root = injectPrompt("Attachments")
    this.list = () => root.list()
    bindProps(() =>
      root.list().length === 0
        ? absentProps("prompt-input", String(root.api().root()["data-instance"]))
        : root.api().chipsPart(),
    )
  }
}

/** The draft's length: its content, or `used` (`used/max` with a `max`). */
@Component({
  selector: "[rindPromptInputCharacterCount]",
  exportAs: "rindPromptInputCharacterCount",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class PromptInputCharacterCount {
  /** A soft limit: over it, nothing is sent and the input is invalid; never a truncation. */
  readonly max = input<number>()
  /** Counts the draft (a tokenizer for a token limit). Default: characters, a line break once. */
  readonly count = input<(value: string) => number>()
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const root = injectPrompt("CharacterCount")
    // After the first render, as React's effect: the server HTML has no limit yet.
    if (inject(PLATFORM_ID) === "browser") {
      const ready = signal(false)
      afterNextRender(() => ready.set(true))
      effect(() => {
        if (!ready()) return
        const state = { max: this.max(), count: this.count() }
        untracked(() => root.countState.set(state))
      })
      inject(DestroyRef).onDestroy(() => root.countState.set(null))
    }
    this.text = () => {
      // Frozen at the committed draft while a composition is open (core's derivation).
      const used = root.countState() ? root.api().derived.used : 0
      const max = this.max()
      return max === undefined ? `${used}` : `${used}/${max}`
    }
    bindProps(() => root.api().characterCount(), { owns: ["count", "max"] })
  }
}
