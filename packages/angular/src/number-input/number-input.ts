// Number Input parts: wiring only. The machine owns the value and the text; connect every
// attribute, the insertion plan and the key mapping. The Root is a Field when not inside one
// (it composes rindFieldRoot); the hidden number input carries name, constraints and reset.
import {
  afterEveryRender,
  afterNextRender,
  Component,
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
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  announcerCapability,
  canStepNumber,
  createNumberParser,
  describeKey,
  type FieldControlBinding,
  focusSafely,
  hiddenFormInput,
  inputModeOf,
  type MessageOverrides,
  mergeFieldProps,
  type NumberInputCommitDetails,
  type NumberInputEvent,
  type NumberInputMessages,
  type NumberInputReason,
  type NumberInputTrigger,
  numberInputConnect,
  numberInputKey,
  numberInputMachine,
  numberInputMessages,
  partId,
  planInsertion,
  quirkActive,
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
import { injectModality, injectPress } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

/** Machine reasons → the public ones (spec "Value And Callbacks"). */
function publicReason(type: string): NumberInputReason {
  if (type.startsWith("after:")) return "SPIN"
  switch (type) {
    case "FIRST":
    case "LAST":
      return "EDGE"
    case "WHEEL":
      return "WHEEL"
    case "PASTE":
      return "PASTE"
    case "RESET":
      return "RESET"
    case "COMMIT":
    case "INPUT.ADOPT":
      return "INPUT.COMMIT"
    default:
      return "STEP"
  }
}

export interface NumberInputChangeDetails {
  readonly reason: NumberInputReason
  readonly modality: string | undefined
  cancel(): void
}

export interface NumberInputState {
  readonly value: number | null
  readonly text: string
  readonly spinning: boolean
  readonly composing: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

const NUMBER_INPUT = new InjectionToken<NumberInputRoot>("rind-ui.number-input")

function injectNumberInput(part: string): NumberInputRoot {
  const root = inject(NUMBER_INPUT, { optional: true })
  if (!root) throw new Error(`rindNumberInput${part} must be inside rindNumberInputRoot`)
  return root
}

const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)

/**
 * A number field: `<div rindNumberInputRoot name="q" [(value)]="qty">` with a Label and a
 * Control holding the Decrement trigger, the `<input rindNumberInputInput>` and the Increment
 * trigger. Alone it is a Field (it composes `rindFieldRoot`); inside a Field it joins that one.
 */
@Component({
  selector: "[rindNumberInputRoot]",
  exportAs: "rindNumberInputRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
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
    { provide: NUMBER_INPUT, useExisting: forwardRef(() => NumberInputRoot) },
    { provide: FIELD_HOST, useValue: { scope: "number-input" } },
  ],
  template: `<ng-content /><input #hidden [rindProps]="hiddenProps()" />`,
})
export class NumberInputRoot {
  /** Controlled value (`[(value)]`); `null` is empty. */
  readonly value = input<number | null>()
  /** Read at creation (default empty); a later change only changes what a form reset restores. */
  readonly defaultValue = input<number | null>(null)
  readonly min = input<number>()
  readonly max = input<number>()
  /** Default 1 (0.01 for percent). A commit snaps to an explicit step only. */
  readonly step = input<number>()
  readonly largeStep = input<number>()
  readonly formatOptions = input<Intl.NumberFormatOptions>()
  readonly locale = input<string>()
  readonly dir = input<"ltr" | "rtl">()
  readonly commitBehavior = input<"snap" | "validate">()
  readonly allowWheel = input(false, {
    transform: (v: boolean | "" | undefined) => v !== undefined && v !== false,
  })
  readonly spinOnPress = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  readonly spinDelay = input<number>()
  readonly spinInterval = input<number>()
  readonly form = input<string>()
  readonly messages = input<MessageOverrides<NumberInputMessages>>()
  /** Every change proposes a value; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<{
    value: number | null
    details: NumberInputChangeDetails
  }>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<number | null>()
  /** Once per interaction that changed the value (key, stepper release, wheel tick, blur/Enter). */
  readonly valueCommit = output<{ value: number | null; details: NumberInputCommitDetails }>()
  /** Every accepted edit of the text (the value only changes at commit points). */
  readonly inputValueChange = output<string>()

  /** @internal */
  readonly field = inject(FieldRoot, { self: true })
  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly view: ReturnType<typeof injectMachine<typeof numberInputMachine>>["view"]
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof numberInputMachine>>["send"]
  /** @internal */
  readonly parser: Signal<ReturnType<typeof createNumberParser>>
  /** @internal */
  readonly texts: Signal<NumberInputMessages>
  /** @internal */
  readonly disabledState: () => boolean
  /** @internal */
  readonly readOnlyState: () => boolean
  /** @internal */
  readonly direction: Signal<"ltr" | "rtl">
  /** @internal */
  readonly inputEl: { value: Element | null } = { value: null }
  /** @internal */
  readonly formInput: ReturnType<typeof hiddenFormInput>
  /** @internal */
  readonly mounted = signal(false)
  /** @internal */
  readonly pressed = signal({ increment: false, decrement: false })
  /** @internal */
  readonly inputId = signal<string | null>(null)
  /** @internal */
  readonly hiddenProps: Signal<ReturnType<ReturnType<typeof numberInputConnect>["hiddenInput"]>>
  /** The input's state, for the template (`#n="rindNumberInputRoot"`, `n.state()`). */
  readonly state: Signal<NumberInputState>
  private readonly hiddenRef = viewChild<ElementRef<HTMLInputElement>>("hidden")
  /** @internal The hidden number input (the Field's validity element). */
  readonly hiddenInput = () => asInput(this.hiddenRef()?.nativeElement ?? null)

  constructor() {
    const env = injectEnvironment(announcerCapability)
    this.instance = this.field.instance
    const locale = injectLocale(
      () => this.locale(),
      () => this.dir(),
    )
    this.direction = computed(() => locale().dir)
    this.texts = injectMessages("number-input", numberInputMessages, () => this.messages())
    // Cached by value: an inline options object each render keeps the parser (RX#1893).
    this.parser = computed(() => createNumberParser(locale().locale, this.formatOptions()))
    // The enclosing Field's state (this element's own Field is its own inputs).
    const enclosing = inject(FIELD_CONTROL, { optional: true, skipSelf: true }) ?? null
    const fieldsetDisabled = injectFieldsetDisabled()
    this.disabledState = () =>
      this.field.disabled() || enclosing?.().state.disabled === true || fieldsetDisabled()
    this.readOnlyState = () => this.field.readonly() || enclosing?.().state.readOnly === true
    const formInput = hiddenFormInput(
      { input: this.hiddenInput, control: () => asInput(this.inputEl.value) },
      env,
    )
    this.formInput = formInput
    const { view, send } = injectMachine(
      numberInputMachine,
      () => ({
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: (v: number | null, details) => {
          let cancelled = false
          this.valueChangeDetails.emit({
            value: v,
            details: {
              reason: publicReason(details.reason),
              modality: (details.event as { modality?: string }).modality,
              cancel: () => {
                cancelled = true
                details.cancel()
              },
            },
          })
          if (!cancelled) this.valueChange.emit(v)
        },
        onValueCommit: (v: number | null, d: NumberInputCommitDetails) =>
          this.valueCommit.emit({ value: v, details: d }),
        onInputValueChange: (t: string) => this.inputValueChange.emit(t),
        min: this.min(),
        max: this.max(),
        step: this.step(),
        largeStep: this.largeStep(),
        commitBehavior: this.commitBehavior(),
        spinOnPress: this.spinOnPress(),
        spinDelay: this.spinDelay(),
        spinInterval: this.spinInterval(),
        disabled: this.disabledState(),
        readOnly: this.readOnlyState(),
        parser: this.parser(),
        messages: this.texts(),
        id: this.instance(),
      }),
      // The provider's scheduler and announcer, plus the input.
      { scheduler: env.scheduler, announcer: env.announcer, formInput },
    )
    this.view = view
    this.send = send
    this.state = computed(() => ({
      value: view().values.value ?? null,
      text: view().context.text,
      spinning: view().matches("spinning"),
      composing: view().matches("composing"),
      disabled: this.disabledState(),
      readOnly: this.readOnlyState(),
    }))
    // This element's own Field binding (or the enclosing one it joined).
    const binding = injectFieldBindingPeek()
    const apiFor = injectApi(this, binding)
    this.hiddenProps = computed(() => {
      const b = binding?.() ?? null
      const field = mergeFieldProps(
        {
          role: "spinbutton",
          labelable: true,
          disabled: this.disabledState(),
          readOnly: this.readOnlyState(),
          ...(b?.name === undefined ? {} : { name: b.name }),
        },
        b,
      )
      return { ...apiFor().hiddenInput(), name: field.name, required: field.required || undefined }
    })
    const modality = injectModality(env.modality, () => view().context.focused)
    bindProps(
      () => {
        const focused = view().context.focused
        return {
          dir: locale().dir,
          "data-focus": focused ? "" : undefined,
          "data-focus-visible":
            focused && modality() !== "pointer" && modality() !== "touch" ? "" : undefined,
          "data-spinning": view().matches("spinning") ? "" : undefined,
          "data-composing": view().matches("composing") ? "" : undefined,
        }
      },
      {
        owns: [
          "allowwheel",
          "commitbehavior",
          "defaultvalue",
          "dir",
          "fieldmessages",
          "form",
          "formatoptions",
          "largestep",
          "locale",
          "max",
          "messages",
          "min",
          "spindelay",
          "spininterval",
          "spinonpress",
          "step",
          "value",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    const mirror = () => {
      const v = untracked(view).values.value ?? null
      return { value: v === null ? "" : String(v) }
    }
    // After every render: the input shows the value (hydration, a parent's change); no events.
    afterEveryRender(() => formInput.sync(mirror(), { dispatch: false }))
    afterNextRender(() => {
      this.mounted.set(true)
      destroy.onDestroy(
        formInput.track({
          onReset: () => send({ type: "RESET" }),
          current: mirror,
          onNativeInput: (el) => {
            const n = el.value === "" ? null : Number(el.value)
            send({ type: "INPUT.ADOPT", value: n !== null && Number.isFinite(n) ? n : null })
            return true
          },
        }),
      )
    })
  }

  /** @internal */
  setPressed(t: NumberInputTrigger, on: boolean): void {
    const p = untracked(this.pressed)
    if (p[t] !== on) this.pressed.set({ ...p, [t]: on })
  }

  /** @internal */
  ids() {
    const i = this.instance()
    return {
      input: this.inputId() ?? partId("number-input", i, "input"),
      increment: partId("number-input", i, "increment-trigger"),
      decrement: partId("number-input", i, "decrement-trigger"),
      hiddenInput: partId("number-input", i, "hidden-input"),
    }
  }
}

/** The api of a part, with the Field binding merged. Call it in a constructor. */
function injectApi(root: NumberInputRoot, binding: Signal<FieldControlBinding> | null) {
  const env = injectEnvironment()
  const modality = injectModality(env.modality, () => root.view().context.focused)
  return () => {
    const view = root.view()
    const b = binding?.() ?? null
    const field = mergeFieldProps(
      {
        role: "spinbutton",
        labelable: true,
        disabled: root.disabledState(),
        readOnly: root.readOnlyState(),
      },
      b,
    )
    const value = view.values.value ?? null
    const parser = root.parser()
    const range = { min: root.min(), max: root.max(), step: root.step() }
    return numberInputConnect(
      {
        instance: root.instance(),
        value,
        text: view.context.text,
        defaultValue: root.defaultValue(),
        focused: view.context.focused,
        modality: modality(),
        composing: view.matches("composing"),
        spinning: view.matches("spinning"),
        field,
        fieldData: b?.data,
        ids: root.ids(),
        labelId: b?.ids.label,
        ...range,
        canIncrement: canStepNumber(value, 1, range),
        canDecrement: canStepNumber(value, -1, range),
        pressed: root.pressed(),
        parser,
        messages: root.texts(),
        plainTextbox: quirkActive("ios-vo-spinbutton-input", env),
        inputMode: inputModeOf(
          {
            fractions: parser.allowsFraction || (range.step !== undefined && range.step % 1 !== 0),
            allowNegative: range.min === undefined || range.min < 0,
            mounted: root.mounted(),
          },
          env.platform,
        ),
        form: root.form(),
        dir: root.direction(),
      },
      env,
    )
  }
}

/** The group around the triggers and the input. */
@Directive({ selector: "[rindNumberInputControl]", exportAs: "rindNumberInputControl" })
export class NumberInputControl {
  constructor() {
    const root = injectNumberInput("Control")
    const apiFor = injectApi(root, injectFieldBindingPeek())
    bindProps(() => apiFor().control())
  }
}

/** The text input: `<input rindNumberInputInput>` (role spinbutton). */
@Directive({ selector: "[rindNumberInputInput]", exportAs: "rindNumberInputInput" })
export class NumberInputInput {
  readonly id = input<string>()
  readonly inputmode = input<string>()

  constructor() {
    const root = injectNumberInput("Input")
    const env = injectEnvironment()
    const binding = injectFieldControl()
    const apiFor = injectApi(root, binding)
    const el: HTMLInputElement = inject(ElementRef).nativeElement
    root.inputEl.value = el
    const controlId = () =>
      this.id() ?? binding?.().controlId ?? partId("number-input", root.instance(), "input")
    const report = (e: Parameters<FieldControlBinding["report"]>[0]) => binding?.().report(e)
    // Insertions are checked before they apply.
    let caret: number | null = null
    const keypadLocale = () =>
      quirkActive("keypad-decimal-separator", env)
        ? (globalThis.navigator?.language ?? "en")
        : undefined
    bindProps(
      () =>
        joinHandlers(
          {
            ...apiFor().input(),
            id: controlId(),
            ...(this.inputmode() === undefined ? {} : { inputmode: this.inputmode() }),
          },
          {
            onInput: (e: Event) => {
              if (e.currentTarget instanceof HTMLInputElement)
                root.send({ type: "INPUT", text: e.currentTarget.value })
            },
            onKeyDown: (e: KeyboardEvent) => {
              if (e.defaultPrevented) return
              const event = numberInputKey(describeKey(e, env), {
                hasMin: root.min() !== undefined,
                hasMax: root.max() !== undefined,
              })
              if (!event) return
              if (event.type === "COMMIT") {
                // Commit first, then the browser's implicit submission sends the new value.
                root.send(event)
                report({ type: "commit" })
                return
              }
              e.preventDefault()
              root.send(event)
            },
            onPaste: (e: ClipboardEvent) => {
              const target = e.currentTarget
              if (!(target instanceof HTMLInputElement)) return
              const whole =
                target.value === "" ||
                ((target.selectionStart ?? 0) === 0 &&
                  (target.selectionEnd ?? 0) === target.value.length)
              if (!whole || root.disabledState() || root.readOnlyState()) return
              const text = e.clipboardData?.getData("text") ?? ""
              e.preventDefault()
              if (root.parser().parse(text) !== null) root.send({ type: "PASTE", text })
            },
            onCompositionStart: () => root.send({ type: "COMPOSITION.START" }),
            onCompositionEnd: (e: CompositionEvent) => {
              if (e.currentTarget instanceof HTMLInputElement)
                root.send({ type: "COMPOSITION.END", text: e.currentTarget.value })
            },
            onFocusIn: () => root.send({ type: "FOCUS", modality: env.modality.modality() }),
            onFocusOut: () => root.send({ type: "BLUR" }),
          },
        ),
      { owns: ["id", "inputmode"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    let ready = false
    let registeredId: string | undefined
    let unregister: (() => void) | undefined
    const register = (id: string) => {
      registeredId = id
      root.inputId.set(id)
      unregister?.()
      unregister = binding?.().register(
        {
          id,
          labelable: true,
          focus: (m) => void focusSafely(el, env, "programmatic", m),
          validityElement: () => root.hiddenInput(),
          value: () => untracked(root.view).values.value ?? null,
        },
        id,
      )
    }
    // After the first render, as React: the server HTML keeps the provisional id.
    afterNextRender(() => {
      ready = true
      register(untracked(controlId))
      const onBeforeInput = (e: Event) => {
        const ie = e as InputEvent
        if (untracked(root.view).matches("composing") || ie.isComposing) return
        const min = untracked(root.min)
        const plan = planInsertion(
          {
            text: el.value,
            selectionStart: el.selectionStart ?? el.value.length,
            selectionEnd: el.selectionEnd ?? el.value.length,
            data: ie.data,
            inputType: ie.inputType,
          },
          untracked(root.parser),
          { allowNegative: min === undefined || min < 0, keypadLocale: keypadLocale() },
        )
        if (plan.kind === "accept") return
        e.preventDefault()
        if (plan.kind === "replace") {
          caret = plan.caret
          root.send({ type: "INPUT", text: plan.text })
        }
      }
      el.addEventListener("beforeinput", onBeforeInput)
      destroy.onDestroy(() => el.removeEventListener("beforeinput", onBeforeInput))
    })
    // Only a new id re-registers: registering changes the Field's binding, which this reads.
    effect(() => {
      const id = controlId()
      if (!ready || id === registeredId) return
      untracked(() => register(id))
    })
    // Each applied change is reported to the Field once (spec "Field Integration").
    let reported: number | null | undefined
    effect(() => {
      const value = root.view().values.value ?? null
      if (!ready || reported === undefined) {
        reported = value
        return
      }
      if (Object.is(reported, value)) return
      reported = value
      untracked(() => report({ type: "change", value, user: true, composing: false }))
    })
    // The wheel steps the focused input only, vertically, without Ctrl (react-spectrum#1792).
    effect((onCleanup) => {
      if (!(root.view().context.focused && root.allowWheel())) return
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || root.disabledState() || root.readOnlyState()) return
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.deltaY === 0) return
        e.preventDefault()
        root.send({ type: "WHEEL", direction: e.deltaY < 0 ? 1 : -1, large: e.shiftKey })
      }
      el.addEventListener("wheel", onWheel, { passive: false })
      onCleanup(() => el.removeEventListener("wheel", onWheel))
    })
    afterEveryRender(() => {
      if (caret === null) return
      el.setSelectionRange(caret, caret)
      caret = null
    })
    destroy.onDestroy(() => unregister?.())
  }
}

/** The steppers: pressing never takes focus; a mouse press moves it to the input. */
@Directive()
abstract class NumberInputTriggerBase {
  protected wire(t: NumberInputTrigger): void {
    const root = injectNumberInput(t === "increment" ? "IncrementTrigger" : "DecrementTrigger")
    const env = injectEnvironment()
    const apiFor = injectApi(root, injectFieldBindingPeek())
    const own = () =>
      t === "increment" ? apiFor().incrementTrigger() : apiFor().decrementTrigger()
    const press = injectPress({
      env,
      focusOnPress: false,
      suppressTouchContextMenu: true,
      disabled: () => own()["aria-disabled"] === "true",
      send: (e) => {
        if (
          e.type !== "PRESS.START" &&
          e.type !== "PRESS" &&
          e.type !== "PRESS.END" &&
          e.type !== "PRESS.CANCEL"
        )
          return
        // A mouse press moves focus to the input; touch and stylus never do (a stylus tap must
        // not open the tablet keyboard: base-ui#1528).
        if (e.type === "PRESS.START" && e.pointerType === "mouse") {
          const el = asInput(root.inputEl.value)
          if (el && el.ownerDocument.activeElement !== el)
            void focusSafely(el, env, "programmatic", "pointer")
        }
        root.send({
          type: e.type,
          trigger: t,
          pointerType: e.pointerType,
          modality: e.modality,
        } as NumberInputEvent)
      },
    })
    bindProps(() => ({ ...own(), ...press.props }))
    if (inject(PLATFORM_ID) !== "browser") return
    let was = false
    effect(() => {
      const p = press.pressed()
      untracked(() => {
        root.setPressed(t, p)
        // The pointer left a held trigger: repeats stop (the press itself goes on).
        const view = root.view()
        const holding = view.matches("pressing", "spinning") && view.context.trigger === t
        if (was && !p && holding) root.send({ type: "PRESS.LEAVE" })
        was = p
      })
    })
  }
}

@Directive({
  selector: "[rindNumberInputIncrementTrigger]",
  exportAs: "rindNumberInputIncrementTrigger",
})
export class NumberInputIncrementTrigger extends NumberInputTriggerBase {
  constructor() {
    super()
    this.wire("increment")
  }
}

@Directive({
  selector: "[rindNumberInputDecrementTrigger]",
  exportAs: "rindNumberInputDecrementTrigger",
})
export class NumberInputDecrementTrigger extends NumberInputTriggerBase {
  constructor() {
    super()
    this.wire("decrement")
  }
}

/** The Number Input's parts (its Label, Description and ErrorMessage are the Field's). */
export const NumberInput = [
  NumberInputRoot,
  FieldLabel,
  FieldDescription,
  FieldErrorMessage,
  NumberInputControl,
  NumberInputInput,
  NumberInputIncrementTrigger,
  NumberInputDecrementTrigger,
] as const
