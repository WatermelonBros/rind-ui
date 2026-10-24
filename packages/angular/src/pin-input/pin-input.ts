// Pin Input parts: wiring only. The machine owns the value and the caret; edit-plan decides
// every insertion; connect every attribute. Native listeners: `beforeinput` to plan
// insertions, `input` so script fills are seen (input-otp#152).
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  untracked,
} from "@angular/core"
import {
  type FieldControlBinding,
  focusSafely,
  injectStyle,
  type MessageOverrides,
  mergeFieldProps,
  type PinInputEvent,
  type PinInputMessages,
  type PinInputReason,
  type PinValidationType,
  pinInputConnect,
  pinInputMachine,
  pinInputMessages,
  pinInputStyle,
  planEdit,
  renderedValue,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import {
  FIELD_CONTROL,
  FIELD_HOST,
  injectFieldBindingPeek,
  injectFieldControl,
} from "../field/context"
import { FieldDescription, FieldErrorMessage, FieldLabel, FieldRoot } from "../field/field"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectMessages } from "../provider"

declare const process: { env: { NODE_ENV?: string } }

export interface PinInputChangeDetails {
  readonly reason: PinInputReason
}

export interface PinInputState {
  readonly value: string
  readonly complete: boolean
  readonly composing: boolean
  readonly focused: boolean
}

type Rules = {
  readonly length: number
  readonly validationType: PinValidationType | undefined
  readonly pattern: RegExp | undefined
  readonly sanitize: ((t: string) => string) | undefined
}

const PIN_INPUT = new InjectionToken<PinInputRoot>("rind-ui.pin-input")

function injectPinInput(part: string): PinInputRoot {
  const root = inject(PIN_INPUT, { optional: true })
  if (!root) throw new Error(`rindPinInput${part} must be inside rindPinInputRoot`)
  return root
}

const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)

/** Machine events → the public reasons. */
function publicReason(event: PinInputEvent): PinInputReason {
  if (event.type === "EDIT") return event.edit.reason
  if (event.type === "INPUT") return event.reason
  if (event.type === "RESET") return "RESET"
  return "INPUT"
}

/** "Not passed": a `value` input given, even null or undefined, is controlled (ark#3573). */
const UNSET: unique symbol = Symbol("rind-ui.unset")

/**
 * A one-time code: `<div rindPinInputRoot [length]="6">` with a Label and a Control holding
 * the `<input rindPinInputInput>` and one `<div rindPinInputSlot [index]="i">` per character.
 * Alone it is a Field (it composes `rindFieldRoot`); inside a Field it joins that one.
 */
@Directive({
  selector: "[rindPinInputRoot]",
  exportAs: "rindPinInputRoot",
  hostDirectives: [
    {
      directive: FieldRoot,
      inputs: [
        "name",
        "disabled",
        "readonly",
        "required",
        "invalid",
        "touched",
        "dirty",
        "errors",
        "validate",
        "validationMode",
        "validationBehavior",
        "validationDebounce",
        "errorMessageAttribute",
        "messages: fieldMessages",
        "id",
      ],
    },
  ],
  providers: [
    { provide: PIN_INPUT, useExisting: forwardRef(() => PinInputRoot) },
    { provide: FIELD_HOST, useValue: { scope: "pin-input" } },
  ],
})
export class PinInputRoot {
  /** The number of characters (a positive integer). */
  readonly length = input.required<number>()
  /** Controlled (`[(value)]`); `null` renders empty (ark#3573). */
  readonly value = input<string | null | undefined | typeof UNSET>(UNSET)
  readonly defaultValue = input<string>("")
  /** Default `"numeric"`. */
  readonly validationType = input<PinValidationType>()
  /** One accepted character (replaces `validationType`). */
  readonly pattern = input<RegExp>()
  /** Applied after NFKC (e.g. `(t) => t.toUpperCase()`). */
  readonly sanitize = input<(text: string) => string>()
  readonly mask = input(false, { transform: booleanAttribute })
  readonly maskChar = input("•")
  /** Default `"one-time-code"`. */
  readonly autocomplete = input("one-time-code")
  /** Submits the form once a user change completes the code (`requestSubmit`, no focus moves). */
  readonly autoSubmit = input(false, { transform: booleanAttribute })
  readonly enterkeyhint = input<"enter" | "done" | "go" | "next" | "previous" | "search" | "send">()
  /** The id of the form the input belongs to. */
  readonly form = input<string>()
  /** The consumer's direction; the code itself is always laid out left to right. Default: `"ltr"`. */
  readonly dir = input<"ltr" | "rtl">()
  readonly messages = input<MessageOverrides<PinInputMessages>>()
  /** Every change, with its reason. */
  readonly valueChangeDetails = output<{ value: string; details: PinInputChangeDetails }>()
  /** The new value, for `[(value)]`. */
  readonly valueChange = output<string>()
  /** An insertion was refused (its text). */
  readonly valueInvalid = output<string>()
  /** A user change completed the code. */
  readonly valueComplete = output<string>()

  /** @internal */
  readonly field = inject(FieldRoot, { self: true })
  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly view: ReturnType<typeof injectMachine<typeof pinInputMachine>>["view"]
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof pinInputMachine>>["send"]
  /** @internal */
  readonly rules: () => Rules
  /** @internal */
  readonly disabledState: () => boolean
  /** @internal */
  readonly readOnlyState: () => boolean
  /** @internal */
  readonly inputEl: { value: Element | null } = { value: null }
  /** @internal */
  readonly pendingCaret: { current: number | null } = { current: null }
  /** @internal */
  readonly pendingSubmit = { current: false }
  /** @internal */
  readonly slotCount = { current: 0 }
  /** The code's state, for the template (`#p="rindPinInputRoot"`, `p.state()`). */
  readonly state: Signal<PinInputState>

  constructor() {
    this.instance = this.field.instance
    const messages = injectMessages("pin-input", pinInputMessages, () => this.messages())
    // The enclosing Field's state (this element's own Field is its own inputs).
    const enclosing = inject(FIELD_CONTROL, { optional: true, skipSelf: true }) ?? null
    const fieldsetDisabled = injectFieldsetDisabled()
    this.disabledState = () =>
      this.field.disabled() || enclosing?.().state.disabled === true || fieldsetDisabled()
    this.readOnlyState = () => this.field.readonly() || enclosing?.().state.readOnly === true
    this.rules = () => ({
      length: this.length(),
      validationType: this.validationType(),
      pattern: this.pattern(),
      sanitize: this.sanitize(),
    })
    const controlled = () => this.value() !== UNSET
    const shown = () => {
      const v = this.value()
      return v === UNSET ? undefined : renderedValue(this.rules(), v)
    }
    const inputEl = this.inputEl
    const pendingCaret = this.pendingCaret
    const pendingSubmit = this.pendingSubmit
    const { view, send } = injectMachine(pinInputMachine, () => ({
      ...this.rules(),
      value: shown(),
      defaultValue: renderedValue(this.rules(), this.defaultValue()),
      onValueChange: (v: string, details) => {
        this.valueChangeDetails.emit({
          value: v,
          details: { reason: publicReason((details as { event: PinInputEvent }).event) },
        })
        this.valueChange.emit(v)
      },
      onValueInvalid: (t: string) => this.valueInvalid.emit(t),
      onValueComplete: (v: string) => this.valueComplete.emit(v),
      autoSubmit: this.autoSubmit(),
      disabled: this.disabledState(),
      readOnly: this.readOnlyState(),
      messages: messages(),
      id: this.instance(),
      writeCaret: (index: number) => {
        pendingCaret.current = index
      },
      resync: () => {
        // The value Angular renders is already right; the DOM may hold the browser's write.
        const el = asInput(inputEl.value)
        const current = untracked(view).values.value
        if (el && el.value !== current) el.value = current
      },
      // After the completed value is rendered (the form must validate the full code).
      requestSubmit: () => {
        pendingSubmit.current = true
      },
    }))
    this.view = view
    this.send = send
    this.state = computed(() => ({
      value: view().values.value,
      complete: view().values.value.length === this.length(),
      composing: view().matches("composing"),
      focused: view().context.focused,
    }))
    const apiFor = injectApi(this, enclosing)
    bindProps(
      () => {
        const root = apiFor().root()
        const data = Object.fromEntries(
          Object.entries(root).filter(
            ([k]) =>
              k.startsWith("data-") &&
              k !== "data-scope" &&
              k !== "data-part" &&
              k !== "data-instance",
          ),
        )
        return { dir: (root["dir"] as string | undefined) ?? "ltr", ...data }
      },
      {
        owns: [
          "autocomplete",
          "autosubmit",
          "defaultvalue",
          "dir",
          "enterkeyhint",
          "fieldmessages",
          "form",
          "length",
          "mask",
          "maskchar",
          "messages",
          "pattern",
          "sanitize",
          "validationtype",
          "value",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser" || process.env.NODE_ENV === "production") return
    afterNextRender(() => {
      const length = untracked(this.length)
      if (!Number.isInteger(length) || length < 1) {
        console.warn(`[rind-ui] pin-input: length must be a positive integer (got ${length}).`)
      }
      // Every rendered slot counts; the number must match `length`.
      if (this.slotCount.current !== length) {
        console.warn(
          `[rind-ui] pin-input: length is ${length} but ${this.slotCount.current} Slots are rendered.`,
        )
      }
    })
    effect(() => {
      const value = this.value()
      const rendered = shown()
      if (controlled() && typeof value === "string" && value !== rendered) {
        console.warn(
          `[rind-ui] pin-input: the controlled value "${value}" is rendered as "${rendered}" (length ${untracked(this.length)}, rejected characters dropped).`,
        )
      }
    })
  }
}

/** The connect output, with the Field binding merged. Call it in a constructor. */
function injectApi(root: PinInputRoot, binding: Signal<FieldControlBinding> | null) {
  const env = injectEnvironment()
  const modality = injectModality(env.modality, () => root.view().context.focused)
  return () => {
    const view = root.view()
    const b = binding?.() ?? null
    const field = mergeFieldProps(
      {
        role: "textbox",
        labelable: true,
        disabled: root.disabledState(),
        readOnly: root.readOnlyState(),
      },
      b,
    )
    return pinInputConnect({
      ...root.rules(),
      instance: root.instance(),
      value: view.values.value,
      caret: view.context.caret,
      focused: view.context.focused,
      modality: modality(),
      composing: view.matches("composing"),
      field,
      fieldData: b?.data,
      mask: root.mask(),
      maskChar: root.maskChar(),
      autoComplete: root.autocomplete(),
      enterKeyHint: root.enterkeyhint(),
      form: root.form(),
      dir: root.dir(),
    })
  }
}

/** The row of slots, around the input. */
@Directive({ selector: "[rindPinInputControl]", exportAs: "rindPinInputControl" })
export class PinInputControl {
  constructor() {
    const root = injectPinInput("Control")
    const apiFor = injectApi(root, injectFieldBindingPeek())
    bindProps(() => apiFor().control())
  }
}

/** The slot whose box holds `x` (nearest when between two), by `data-instance`. */
function slotAt(input: HTMLInputElement, instance: string, x: number): number | null {
  const control = input.parentElement
  if (!control) return null
  // A press outside the control (a synthetic click without coordinates) is not on a slot.
  const box = control.getBoundingClientRect()
  if (box.width > 0 && (x < box.left || x > box.right)) return null
  let best: { index: number; distance: number } | null = null
  let laidOut = false
  for (const el of control.querySelectorAll<HTMLElement>(
    `[data-scope="pin-input"][data-part="slot"][data-instance="${CSS.escape(instance)}"]`,
  )) {
    const r = el.getBoundingClientRect()
    if (r.width > 0) laidOut = true
    const distance = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
    const index = Number(el.dataset["index"])
    if (!best || distance < best.distance) best = { index, distance }
  }
  // No layout (jsdom): the browser's own caret placement stands.
  return laidOut ? (best?.index ?? null) : null
}

/** The one text input holding the code: `<input rindPinInputInput>`. */
@Directive({ selector: "[rindPinInputInput]", exportAs: "rindPinInputInput" })
export class PinInputInput {
  readonly id = input<string>()

  constructor() {
    const root = injectPinInput("Input")
    const env = injectEnvironment()
    const binding = injectFieldControl()
    const apiFor = injectApi(root, binding)
    const el: HTMLInputElement = inject(ElementRef).nativeElement
    root.inputEl.value = el
    const controlId = () =>
      this.id() ?? binding?.().controlId ?? `pin-input-${root.instance()}-input`.replace(/:/g, "")
    const report = (e: Parameters<FieldControlBinding["report"]>[0]) => binding?.().report(e)
    const value = () => untracked(root.view).values.value
    bindProps(
      () =>
        joinHandlers(
          { ...apiFor().input(), id: controlId() },
          {
            onKeyDown: (e: KeyboardEvent) => {
              // Enter is never prevented (zag#3381); outside an IME it commits for the Field.
              if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229)
                report({ type: "commit" })
            },
            onCompositionStart: (e: CompositionEvent) => {
              const target = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
              root.send({
                type: "COMPOSITION.START",
                caret: target?.selectionStart ?? value().length,
              })
            },
            onCompositionEnd: (e: CompositionEvent) =>
              root.send({ type: "COMPOSITION.END", text: e.data }),
            onFocusIn: () => {
              // Focus (Tab selects the text natively) lands on the collapsed caret, unless a
              // press already planned one.
              if (root.pendingCaret.current === null) {
                root.pendingCaret.current = Math.min(
                  untracked(root.view).context.caret,
                  value().length,
                )
              }
              root.send({ type: "FOCUS", modality: env.modality.modality() })
            },
            onFocusOut: () => root.send({ type: "BLUR" }),
          },
        ),
      { owns: ["id"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // After every render: the DOM shows the value, the planned caret is placed, and a pending
    // auto-submit runs against the full code.
    afterEveryRender(() => {
      // The DOM text follows the value between compositions (an IME owns it meanwhile).
      if (el.value !== value() && !untracked(root.view).matches("composing")) el.value = value()
      // Kept until the input has focus (a press focuses it after the caret was planned).
      const caret = root.pendingCaret.current
      if (caret !== null && el.ownerDocument.activeElement === el) {
        el.setSelectionRange(caret, caret)
        root.pendingCaret.current = null
      }
      if (root.pendingSubmit.current) {
        root.pendingSubmit.current = false
        el.form?.requestSubmit()
      }
    })
    let ready = false
    let registeredId: string | undefined
    let unregister: (() => void) | undefined
    const register = (id: string) => {
      registeredId = id
      unregister?.()
      unregister = binding?.().register(
        {
          id,
          labelable: true,
          focus: (m) => void focusSafely(el, env, "programmatic", m),
          // The input is the form control: its own validity (valueMissing, patternMismatch).
          validityElement: () => el,
          value,
        },
        id,
      )
    }
    afterNextRender(() => {
      ready = true
      injectStyle(el.ownerDocument, "pin-input", pinInputStyle, env)
      register(untracked(controlId))
      const onBeforeInput = (e: Event) => {
        const ie = e as InputEvent
        if (untracked(root.view).matches("composing") || ie.isComposing) return
        if (ie.inputType === "insertCompositionText") return
        const data = ie.data ?? ie.dataTransfer?.getData("text/plain") ?? null
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? start
        const plan = planEdit(
          value(),
          [start, end],
          { inputType: ie.inputType, data },
          root.rules(),
        )
        if (plan.accept && plan.edit === null) return
        e.preventDefault()
        root.send(
          plan.accept ? { type: "EDIT", edit: plan.edit } : { type: "INVALID", text: plan.text },
        )
      }
      const onInput = (e: Event) => {
        const ie = e as Partial<InputEvent>
        if (untracked(root.view).matches("composing") || ie.isComposing) return
        if (el.value === value()) return
        const native = typeof ie.inputType === "string" && /^(delete|history)/.test(ie.inputType)
        root.send({ type: "INPUT", text: el.value, reason: native ? "INPUT" : "AUTOFILL" })
      }
      // A key an IME owns (isComposing, keyCode 229) never moves the active slot. Its
      // selectionchange arrives as a later task, so the flag holds until the next own key,
      // a press or the composition's end.
      let imeKey = false
      const onKeyDown = (e: Event) => {
        const k = e as KeyboardEvent
        imeKey = k.isComposing || k.keyCode === 229
      }
      const onSettled = () => {
        imeKey = false
      }
      const onSelection = () => {
        if (imeKey || el.ownerDocument.activeElement !== el || el.selectionStart === null) return
        if (el.selectionStart !== untracked(root.view).context.caret)
          root.send({ type: "CARET", index: el.selectionStart })
      }
      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0 || root.disabledState()) return
        const index = slotAt(el, untracked(root.instance), e.clientX)
        if (index === null) return
        // No native caret placement: the caret goes to the slot under the press.
        e.preventDefault()
        if (el.ownerDocument.activeElement !== el) void focusSafely(el, env, "programmatic")
        root.send({
          type: "SLOT.PRESS",
          index,
          modality: e.pointerType === "touch" ? "touch" : "pointer",
        })
      }
      // A form reset: the current defaultValue comes back (read once dispatch ended).
      const formEl = el.form
      const onReset = (e: Event) =>
        env.scheduler.setTimeout(() => {
          if (!e.defaultPrevented) root.send({ type: "RESET" })
        }, 0)
      el.addEventListener("beforeinput", onBeforeInput)
      el.addEventListener("input", onInput)
      el.addEventListener("pointerdown", onPointerDown)
      el.addEventListener("keydown", onKeyDown, true)
      el.addEventListener("pointerdown", onSettled, true)
      el.addEventListener("compositionend", onSettled)
      el.ownerDocument.addEventListener("selectionchange", onSelection)
      formEl?.addEventListener("reset", onReset)
      destroy.onDestroy(() => {
        el.removeEventListener("beforeinput", onBeforeInput)
        el.removeEventListener("input", onInput)
        el.removeEventListener("pointerdown", onPointerDown)
        el.removeEventListener("keydown", onKeyDown, true)
        el.removeEventListener("pointerdown", onSettled, true)
        el.removeEventListener("compositionend", onSettled)
        el.ownerDocument.removeEventListener("selectionchange", onSelection)
        formEl?.removeEventListener("reset", onReset)
      })
    })
    // Only a new id re-registers: registering changes the Field's binding, which this reads.
    effect(() => {
      const id = controlId()
      if (!ready || id === registeredId) return
      untracked(() => register(id))
    })
    // Each applied change is reported to the Field once.
    let reported: string | undefined
    effect(() => {
      const now = root.view().values.value
      if (!ready || reported === undefined) {
        reported = now
        return
      }
      if (reported === now) return
      reported = now
      untracked(() => report({ type: "change", value: now, user: true, composing: false }))
    })
    destroy.onDestroy(() => unregister?.())
  }
}

/** One character's box: `<div rindPinInputSlot [index]="0" #s="rindPinInputSlot">`. */
@Directive({ selector: "[rindPinInputSlot]", exportAs: "rindPinInputSlot" })
export class PinInputSlot {
  /** The slot's position, from 0. */
  readonly index = input.required<number>()
  /** The slot's character, for the template (`s.char()`). */
  readonly char: Signal<string | undefined>

  constructor() {
    const root = injectPinInput("Slot")
    const apiFor = injectApi(root, injectFieldBindingPeek())
    this.char = computed(() => root.view().values.value[this.index()])
    root.slotCount.current += 1
    inject(DestroyRef).onDestroy(() => {
      root.slotCount.current -= 1
    })
    bindProps(() => apiFor().slot(this.index()), { owns: ["index"] })
  }
}

/** The Pin Input's parts (its Label, Description and ErrorMessage are the Field's). */
export const PinInput = [
  PinInputRoot,
  FieldLabel,
  FieldDescription,
  FieldErrorMessage,
  PinInputControl,
  PinInputInput,
  PinInputSlot,
] as const
