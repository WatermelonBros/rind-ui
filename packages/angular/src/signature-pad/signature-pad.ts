import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  announcerCapability,
  exportSignature,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  mergeFieldProps,
  type PartProps,
  partId,
  preventTouchScribble,
  type SignatureExportOptions,
  type SignaturePadEvent,
  type SignaturePadMessages,
  type SignaturePadState,
  type SignatureValue,
  type StrokeMessage,
  signatureFormValue,
  signaturePadConnect,
  signaturePadMachine,
  signaturePadMessages,
  startStroke,
  startsStroke,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages, withCapabilities } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

/** The pad's state, for the template (`#s="rindSignaturePadRoot"`, `s.state()`). */
export interface SignaturePadRenderState {
  readonly state: SignaturePadState
  readonly value: SignatureValue
  readonly empty: boolean
  readonly strokeCount: number
}

const SIGNATURE_PAD = new InjectionToken<SignaturePadRoot>("rind-ui.signature-pad")

function injectSignaturePad(part: string): SignaturePadRoot {
  const root = inject(SIGNATURE_PAD, { optional: true })
  if (!root) throw new Error(`rindSignaturePad${part} must be inside rindSignaturePadRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))

const MESSAGE_EVENT = {
  down: "POINTER.DOWN",
  move: "POINTER.MOVE",
  up: "POINTER.UP",
  cancel: "POINTER.CANCEL",
} as const

/** A stroke-input message as the machine's event. */
const strokeEvent = (m: StrokeMessage): SignaturePadEvent =>
  // Sound: each message's fields are those of the event it maps to (pointerId, point/points/box).
  ({ ...m, type: MESSAGE_EVENT[m.type] }) as SignaturePadEvent

/**
 * A hand-drawn signature: `<div rindSignaturePadRoot name="signature">` with a Label, a Control
 * holding the Segment (the strokes) and a Guide, a Status, and Clear and Undo triggers; it
 * renders the hidden form input after its content.
 */
@Component({
  selector: "[rindSignaturePadRoot]",
  exportAs: "rindSignaturePadRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: SIGNATURE_PAD, useExisting: forwardRef(() => SignaturePadRoot) }],
  template: `<ng-content /><input #input [rindProps]="inputProps()" />`,
})
export class SignaturePadRoot {
  /** The strokes, controlled (`[(value)]`): `{ width, height, strokes }`. */
  readonly value = input<SignatureValue>()
  /** The strokes, uncontrolled. */
  readonly defaultValue = input<SignatureValue>()
  /** The form field's name. */
  readonly name = input<string>()
  /** The form id, when the pad is outside it. */
  readonly form = input<string>()
  /** What the form submits: an SVG data URL (default), or the strokes as JSON. */
  readonly formValue = input<"svg" | "json">("svg")
  /** The ink colour inlined in the submitted SVG. Default "#000". */
  readonly inkColor = input<string>("#000")
  /** An empty pad blocks submit. */
  readonly required = input(false, { transform: booleanAttribute })
  /** No drawing, not submitted. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Shows and submits the strokes; no drawing, clear or undo. */
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Points closer than this to the previous one are dropped (px). Default 1. */
  readonly minDistance = input(undefined, { transform: optionalNumber })
  /** Inside a Field, also set by the Field. */
  readonly invalid = input(false, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<SignaturePadMessages>>()
  /** Default: the provider's locale (the announcements' language). */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** When a stroke ends, on clear, undo and form reset; never while drawing. */
  readonly valueChange = output<SignatureValue>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof signaturePadConnect>>
  /** @internal */
  readonly send: (event: SignaturePadEvent) => void
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"label" | "status">>
  /** @internal */
  readonly ids: () => { readonly label: string; readonly status: string }
  /** @internal The Control, once rendered (the export's colour, the invalid focus). */
  readonly control = signal<HTMLElement | null>(null)
  readonly state: Signal<SignaturePadRenderState>
  /** @internal */
  protected readonly inputProps: Signal<PartProps>
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>("input")

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability)
    const messages = injectMessages("signature-pad", signaturePadMessages, () => this.messages())
    this.registry = injectPartRegistry<"label" | "status">(() => ({
      scope: "signature-pad",
      root: instance(),
    }))
    const locale = injectLocale(() => this.locale())
    const binding = injectFieldControl()
    const fieldsetContext = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    const inputEl = () => this.inputRef()?.nativeElement ?? null
    const invalid = signal(false)
    const formInput = hiddenFormInput({ input: inputEl, control: () => this.control() }, env)
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "img",
          labelable: false,
          disabled: this.disabled() || fieldsetContext() || fieldsetDom(),
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid() || invalid(),
          name: this.name(),
        },
        binding?.() ?? null,
      ),
    )
    const { view, send } = injectMachine(
      signaturePadMachine,
      () => ({
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: (v: SignatureValue) => this.valueChange.emit(v),
        disabled: field().disabled,
        readOnly: field().readOnly,
        minDistance: this.minDistance(),
        messages: messages(),
        id: instance(),
        lang: locale().locale,
      }),
      withCapabilities(env, {
        syncInput: (v: SignatureValue, dispatch: boolean) =>
          formInput.sync(
            { value: signatureFormValue(v, untracked(this.formValue), untracked(this.inkColor)) },
            { dispatch },
          ),
      }),
    )
    this.send = send
    const ids = () => ({
      label: partId("signature-pad", instance(), "label"),
      control: partId("signature-pad", instance(), "control"),
      status: partId("signature-pad", instance(), "status"),
      input: partId("signature-pad", instance(), "hidden-input"),
    })
    this.ids = ids
    const labelId = injectRenderedId(this.registry, "label")
    const statusId = injectRenderedId(this.registry, "status")
    // Inside a Field without its own Label, the Field's label names the Control.
    const label = () => labelId() ?? binding?.().ids.label
    this.api = computed(() =>
      signaturePadConnect(
        {
          instance: instance(),
          state: view().state,
          value: view().values.value,
          stroke: view().context.stroke,
          messages: messages(),
          ids: {
            label: label() ?? ids().label,
            control: ids().control,
            status: statusId() ?? ids().status,
            input: ids().input,
          },
          rendered: { label: label() !== undefined, status: statusId() !== undefined },
          disabled: field().disabled,
          readOnly: field().readOnly,
          required: field().required,
          invalid: field().invalid,
          name: field().name,
          describedBy: field()["aria-describedby"],
          form: this.form(),
          formValue: this.formValue(),
          inkColor: this.inkColor(),
        },
        env,
      ),
    )
    this.state = computed(() => ({
      state: view().state,
      value: view().values.value,
      empty: this.api().empty,
      strokeCount: this.api().strokeCount,
    }))
    this.inputProps = computed(() => this.api().hiddenInput())
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "defaultvalue",
          "disabled",
          "form",
          "formvalue",
          "id",
          "inkcolor",
          "invalid",
          "locale",
          "messages",
          "mindistance",
          "name",
          "readonly",
          "required",
          "value",
        ],
      },
    )
    // An invalid submit marks the pad until it is signed or reset.
    effect(() => {
      if (!this.api().empty) untracked(() => invalid.set(false))
    })

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // Every render: the input mirrors the value (hydration, a controlled value ignored).
    afterEveryRender(() =>
      formInput.sync({ value: untracked(this.api).formValue }, { dispatch: false }),
    )
    let resetting = false
    const ready = signal(false)
    afterNextRender(() => {
      ready.set(true)
      // field-control: one control; the hidden input is its validity element, the Control its focus.
      if (binding) {
        const id = untracked(ids).control
        destroy.onDestroy(
          binding().register(
            {
              id,
              labelable: false,
              focus: (m) => {
                const c = this.control()
                if (c) void focusSafely(c, env, "programmatic", m)
              },
              validityElement: inputEl,
              value: () => untracked(view).values.value,
            },
            id,
          ),
        )
      }
      const el = inputEl()
      if (!el) return
      const w = watchFieldsetDisabled(el, (d) => fieldsetDom.set(d))
      fieldsetDom.set(w.disabled)
      const onInvalid = () => invalid.set(true)
      el.addEventListener("invalid", onInvalid)
      const stop = formInput.track({
        onReset: () => {
          resetting = true
          invalid.set(false)
          send({ type: "RESET" })
        },
        current: () => ({ value: untracked(this.api).formValue }),
      })
      destroy.onDestroy(() => {
        w.stop()
        el.removeEventListener("invalid", onInvalid)
        stop()
      })
    })
    let reported: SignatureValue | undefined
    effect(() => {
      const now = view().values.value
      if (!ready() || reported === undefined) {
        reported = now
        return
      }
      if (reported === now) return
      reported = now
      // A form reset is not the user's change: no commit (the Field revalidates on its own).
      const user = !resetting
      resetting = false
      untracked(() => {
        binding?.().report({ type: "change", value: now, user, composing: false })
        if (user) binding?.().report({ type: "commit" })
      })
    })
  }

  /** The signature as an image (PNG unless `type` says otherwise), in the Control's ink colour. */
  toBlob(options?: SignatureExportOptions): Promise<Blob> {
    const el = this.control()
    return exportSignature(untracked(this.state).value, {
      ...options,
      color: el ? getComputedStyle(el).color : this.inkColor(),
      ...(el ? { doc: el.ownerDocument } : {}),
    })
  }

  /** Saves the image as a file (default "signature.png"). */
  async download(filename = "signature.png", options?: SignatureExportOptions): Promise<void> {
    const blob = await this.toBlob(options)
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    // After the click's task: the download has taken the URL.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Names the Control and completes the triggers' names ("Clear Signature"). */
@Directive({ selector: "[rindSignaturePadLabel]", exportAs: "rindSignaturePadLabel" })
export class SignaturePadLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectSignaturePad("Label")
    const own = () => this.id() ?? root.ids().label
    injectRegisterPart(root.registry, "label", own)
    bindProps(() => ({ ...root.api().label(), id: own() }), { owns: ["id"] })
  }
}

/** The drawing surface: `role="img"`, named by the Label, described by the Status. */
@Directive({ selector: "[rindSignaturePadControl]", exportAs: "rindSignaturePadControl" })
export class SignaturePadControl {
  constructor() {
    const root = injectSignaturePad("Control")
    const el: HTMLElement = inject(ElementRef).nativeElement
    root.control.set(el)
    let stop: (() => void) | null = null
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() => {
        const off = preventTouchScribble(el)
        destroy.onDestroy(() => {
          off()
          stop?.()
          root.control.set(null)
        })
      })
    }
    bindProps(() =>
      joinHandlers(root.api().control(), {
        onPointerDown: (e: PointerEvent) => {
          if (!startsStroke(e)) return
          // Text selection and focus moves would follow the pen (the surface draws).
          e.preventDefault()
          stop = startStroke(el, e, (m) => {
            if (m.type === "up" || m.type === "cancel") stop = null
            root.send(strokeEvent(m))
          })
        },
      }),
    )
  }
}

/** `<svg rindSignaturePadSegment>`: one `<path>` per stroke, in `currentColor`. */
@Component({
  selector: "svg[rindSignaturePadSegment]",
  exportAs: "rindSignaturePadSegment",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `@for (p of strokes(); track $index) {<svg:path [rindProps]="p" />}`,
})
export class SignaturePadSegment {
  /** @internal */
  protected readonly strokes: Signal<readonly PartProps[]>
  constructor() {
    const root = injectSignaturePad("Segment")
    this.strokes = computed(() => root.api().paths.map((d) => root.api().stroke(d)))
    bindProps(() => root.api().segment())
  }
}

/** `aria-hidden`; the line to sign on. */
@Directive({ selector: "[rindSignaturePadGuide]", exportAs: "rindSignaturePadGuide" })
export class SignaturePadGuide {
  constructor() {
    const root = injectSignaturePad("Guide")
    bindProps(() => root.api().guide())
  }
}

/** Visually hidden: "Not signed" or "Signed" (its content replaces it). */
@Component({
  selector: "[rindSignaturePadStatus]",
  exportAs: "rindSignaturePadStatus",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class SignaturePadStatus {
  readonly id = input<string>()
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectSignaturePad("Status")
    const own = () => this.id() ?? root.ids().status
    injectRegisterPart(root.registry, "status", own)
    this.text = computed(() => root.api().statusText)
    bindProps(() => ({ ...root.api().status(), id: own() }), { owns: ["id"] })
  }
}

/** Clear and Undo: a button that stays focusable when there is nothing to do. */
function injectTrigger(part: "ClearTrigger" | "UndoTrigger") {
  const root = injectSignaturePad(part)
  const el: Element = inject(ElementRef).nativeElement
  const tag = el.tagName.toLowerCase()
  const native = tag === "button" || tag === "input"
  const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
  // A consumer name replaces the default one, labelled-by included.
  const ownName = read("aria-label") !== null && read("aria-labelledby") === null
  const env = injectEnvironment()
  // Tracks the modality from the first render, so the first keyboard focus is already visible.
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  bindProps(() => {
    const t = { tag, focused: focused(), modality: modality() }
    const api = part === "ClearTrigger" ? root.api().clearTrigger(t) : root.api().undoTrigger(t)
    return joinHandlers(ownName ? { ...api, "aria-labelledby": undefined } : api, {
      // Nothing to do (aria-disabled): the machine's guard ignores it; focus stays.
      onClick: () => root.send({ type: part === "ClearTrigger" ? "CLEAR" : "UNDO" }),
      // A non-button element: Enter and Space click it, as a button would.
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
    })
  })
}

/** Removes every stroke: `<button rindSignaturePadClearTrigger>`. */
@Directive({
  selector: "[rindSignaturePadClearTrigger]",
  exportAs: "rindSignaturePadClearTrigger",
})
export class SignaturePadClearTrigger {
  constructor() {
    injectTrigger("ClearTrigger")
  }
}

/** Removes the last stroke: `<button rindSignaturePadUndoTrigger>`. */
@Directive({ selector: "[rindSignaturePadUndoTrigger]", exportAs: "rindSignaturePadUndoTrigger" })
export class SignaturePadUndoTrigger {
  constructor() {
    injectTrigger("UndoTrigger")
  }
}

/** The Signature Pad's parts, for a standalone component's `imports`. */
export const SignaturePad = [
  SignaturePadRoot,
  SignaturePadLabel,
  SignaturePadControl,
  SignaturePadSegment,
  SignaturePadGuide,
  SignaturePadStatus,
  SignaturePadClearTrigger,
  SignaturePadUndoTrigger,
] as const
