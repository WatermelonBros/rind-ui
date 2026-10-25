// Color Field parts (design §6): wiring only. The Color Field's machine owns the draft and the
// commit points; the text filter runs on the resulting text in `beforeinput` and again in
// `input` (react-spectrum#3985). Internal: the Color Picker's hex / CSS input is this field
// bound to the picker's colour, its channel inputs a Number Input bound to one channel.
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
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorSpace,
  colorValueMachine,
  colorValueOf,
  describeKey,
  type FieldMessages,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  makeColor,
  mergeFieldProps,
  type PartProps,
  partId,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  acceptColorText,
  COLOR_PICKER_SCOPE,
  type ColorFieldFormat,
  type ColorFieldMessages,
  channelInputNaming,
  colorChannelFieldProps,
  colorFieldConnect,
  colorFieldFormValue,
  colorFieldKeyEvent,
  colorFieldMachine,
  colorFieldMessages,
  colorFieldPart,
  colorFieldValue,
  colorVariables,
} from "@rind-ui/core/internal"
import { bindProps, joinHandlers } from "../bind-props"
import { COLOR_FLUSH, injectColorBinding } from "../color-binding"
import { colorReader } from "../color-input"
import { FIELD_CONTROL, FIELD_HOST, injectFieldControl } from "../field/context"
import { FieldRoot } from "../field/field"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import {
  NUMBER_INPUT_TOKEN,
  NumberInputInput,
  NumberInputRoot,
  type NumberInputSource,
} from "../number-input/number-input"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

export interface ColorFieldState {
  readonly value: Color | null
  readonly text: string
  readonly dirty: boolean
  readonly invalid: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export type ColorFieldReason = "INPUT.COMMIT" | "RESET" | "ADOPT"

export interface ColorFieldChangeEvent {
  readonly value: Color | null
  readonly details: ColorChangeDetails<ColorFieldReason>
}

const reasonOf = (r: string): ColorFieldReason =>
  r === "RESET" ? "RESET" : r === "ADOPT" ? "ADOPT" : "INPUT.COMMIT"

const asInput = (el: Element | null | undefined) => (el instanceof HTMLInputElement ? el : null)

/** What decides a Color Field: its own inputs, or a picker. Internal. */
interface ColorFieldSource {
  readonly value: () => Color | null | undefined
  readonly defaultValue: () => Color | null
  readonly format: () => ColorFieldFormat
  readonly alpha: () => boolean
  readonly colorSpace: () => ColorSpace | undefined
  readonly disabled: () => boolean
  readonly readOnly: () => boolean
  readonly locale: () => string | undefined
  readonly dir: () => "ltr" | "rtl" | undefined
  readonly messages: () => MessageOverrides<ColorFieldMessages> | undefined
  readonly form: () => string | undefined
  readonly onValueChange: (
    color: Color | null,
    details: ColorChangeDetails<ColorFieldReason>,
  ) => void
  readonly onInputValueChange: (text: string) => void
  /** What the Input gets besides its own props (the picker's input name). */
  readonly inputProps: () => PartProps
}

const COLOR_FIELD = new InjectionToken<ColorFieldBase>("rind-ui.color-field")

function injectColorField(part: string): ColorFieldBase {
  const root = inject(COLOR_FIELD, { optional: true })
  if (!root) throw new Error(`rindColorField${part} must be inside rindColorFieldRoot`)
  return root
}

/** The field's inputs a FieldRoot host directive takes (as the Text Field's). */
const FIELD_INPUTS = [
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
]

/** The Color Field, whatever decides it. A subclass provides `src` and renders `#hidden`. Internal. */
@Directive()
export abstract class ColorFieldBase {
  /** @internal */
  protected abstract readonly src: ColorFieldSource
  /** @internal */
  readonly field = inject(FieldRoot, { self: true })
  /** @internal */
  readonly api: Signal<ReturnType<typeof colorFieldConnect>>
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof colorFieldMachine>>["send"]
  /** @internal */
  readonly inputEl: { value: HTMLInputElement | null } = { value: null }
  /** @internal */
  readonly focused = signal(false)
  /** @internal */
  readonly current: () => Color | null
  /** @internal */
  readonly texts: Signal<ColorFieldMessages>
  /** @internal */
  readonly inputExtra = (): PartProps => this.src.inputProps()
  /** @internal */
  readonly fmt = () => this.src.format()
  /** @internal */
  readonly withAlpha = () => this.src.alpha()
  /** The field's state, for the template (`#f="rindColorFieldRoot"`, `f.state()`). */
  readonly state: Signal<ColorFieldState>
  /** @internal */
  protected readonly hiddenProps: Signal<PartProps>
  private readonly hiddenRef = viewChild<ElementRef<HTMLInputElement>>("hidden")
  /** @internal */
  readonly hiddenInput = () => asInput(this.hiddenRef()?.nativeElement)

  constructor() {
    const env = injectEnvironment()
    const instance = this.field.instance
    const src = () => this.src
    const loc = injectLocale(
      () => src().locale(),
      () => src().dir(),
    )
    this.texts = injectMessages("color-field", colorFieldMessages, () => src().messages())
    const enclosing = inject(FIELD_CONTROL, { optional: true, skipSelf: true }) ?? null
    const fieldsetDisabled = injectFieldsetDisabled()
    const disabled = () =>
      src().disabled() || enclosing?.().state.disabled === true || fieldsetDisabled()
    const readOnly = () => src().readOnly() || enclosing?.().state.readOnly === true
    const formInput = hiddenFormInput(
      { input: this.hiddenInput, control: () => this.inputEl.value },
      env,
    )
    const { view, send } = injectMachine(
      colorFieldMachine,
      () => ({
        value: src().value(),
        defaultValue: src().defaultValue(),
        format: src().format(),
        alpha: src().alpha(),
        colorSpace: src().colorSpace(),
        disabled: disabled(),
        readOnly: readOnly(),
        onValueChange: (c: Color | null, d: { reason: string; cancel(): void }) => {
          // Uncontrolled: the form value is current before an implicit submission reads it.
          if (untracked(src().value) === undefined) {
            formInput.sync({ value: colorFieldFormValue(c) }, { dispatch: false })
          }
          src().onValueChange(c, {
            reason: reasonOf(d.reason),
            space: c?.space ?? untracked(src().colorSpace) ?? "rgb",
            cancel: d.cancel,
          })
        },
        onInputValueChange: (t: string) => src().onInputValueChange(t),
      }),
      {},
    )
    this.send = send
    const modality = injectModality(env.modality, this.focused)
    // This element's own Field binding (or the enclosing one it joined).
    const binding = inject(FIELD_CONTROL, { optional: true }) ?? null
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "textbox",
          labelable: true,
          disabled: disabled(),
          readOnly: readOnly(),
          required: this.field.required(),
          invalid: this.field.invalid(),
        },
        binding?.() ?? null,
      ),
    )
    this.current = () =>
      colorFieldValue(
        {
          value: src().value(),
          defaultValue: src().defaultValue(),
          format: src().format(),
          alpha: src().alpha(),
        },
        view().values.value,
      )
    this.api = computed(() => {
      const dirty = view().state !== "idle"
      const i = instance()
      return colorFieldConnect({
        instance: i,
        value: this.current(),
        draft: dirty ? view().context.draft : null,
        invalidDraft: view().state === "invalid",
        format: src().format(),
        alpha: src().alpha(),
        field: field(),
        focused: this.focused(),
        modality: modality(),
        ids: {
          input: partId("color-field", i, "input"),
          hiddenInput: partId("color-field", i, "hidden-input"),
        },
        form: src().form(),
        defaultValue: src().defaultValue(),
      })
    })
    this.state = computed(() => ({
      value: this.current(),
      text: this.api().text,
      dirty: view().state !== "idle",
      invalid: view().state === "invalid" || field().invalid,
      disabled: disabled(),
      readOnly: readOnly(),
    }))
    this.hiddenProps = computed(() => ({
      ...this.api().hiddenInput(),
      ...(field().name === undefined ? {} : { name: field().name }),
      required: field().required || undefined,
    }))
    // Inside a Field (the picker's content) the root is a plain element: no direction of its own.
    const joined = () => this.field.parts.joined
    bindProps(() => ({ ...(joined() ? {} : { dir: loc().dir }), ...this.api().rootData }), {
      owns: [
        "alpha",
        "colorspace",
        "defaultvalue",
        "dir",
        "fieldmessages",
        "form",
        "format",
        "locale",
        "messages",
        "value",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // An owner's flush (a picker closing) commits a valid draft first.
    const registry = inject(COLOR_FLUSH, { optional: true })
    if (registry) destroy.onDestroy(registry.register(() => send({ type: "FLUSH" })))
    const mirror = () => ({ value: colorFieldFormValue(untracked(this.current)) })
    // After every render: the hidden input mirrors the value; a committed text that is not a
    // colour makes the field invalid (the Field's badInput).
    afterEveryRender(() => {
      formInput.sync(mirror(), { dispatch: false })
      const s = untracked(this.state)
      this.hiddenInput()?.setCustomValidity(
        s.dirty && s.invalid ? untracked(this.texts).invalid : "",
      )
    })
    afterNextRender(() =>
      destroy.onDestroy(
        formInput.track({
          onReset: () => send({ type: "RESET" }),
          current: mirror,
          onNativeInput: (el) => {
            send({ type: "ADOPT", text: el.value })
            return true
          },
        }),
      ),
    )
    // The modality tracker must see the key or pointer that comes before the input's focus.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/**
 * A text input for a whole colour: hex by default, any CSS colour with `format="css"`:
 * `<div rindColorFieldRoot name="fill">` with a Label and an `<input rindColorFieldInput>`.
 * Internal.
 */
@Component({
  selector: "[rindColorFieldRoot]",
  exportAs: "rindColorFieldRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: FieldRoot, inputs: FIELD_INPUTS }],
  providers: [
    { provide: COLOR_FIELD, useExisting: forwardRef(() => ColorFieldRoot) },
    {
      provide: FIELD_HOST,
      useValue: { scope: COLOR_PICKER_SCOPE, rootPart: colorFieldPart("root") },
    },
  ],
  template: `<ng-content /><input #hidden [rindProps]="hiddenProps()" />`,
})
export class ColorFieldRoot extends ColorFieldBase {
  /** The colour (`[(value)]`); null: no colour. */
  readonly value = input<string | Color | null>()
  /** Default `null` (no colour). */
  readonly defaultValue = input<string | Color | null>()
  /** `hex` (default): hex digits with an optional `#`; `css`: any CSS colour. */
  readonly format = input<ColorFieldFormat>("hex")
  /** Accept and show 8-digit hex (default false: the alpha never changes). */
  readonly alpha = input(false, { transform: booleanAttribute })
  readonly colorSpace = input<ColorSpace>()
  /** The id of the form the hidden input belongs to. */
  readonly form = input<string>()
  /** Sets the direction when `dir` is not given. Default: the provider's. */
  readonly locale = input<string>()
  /** Reading direction of the root. Default: the locale's, else the provider's. */
  readonly dir = input<"ltr" | "rtl">()
  readonly messages = input<MessageOverrides<ColorFieldMessages>>()
  /** The Field's messages when the Root is the Field. */
  readonly fieldMessages = input<MessageOverrides<FieldMessages>>()
  /** Every committed change; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ColorFieldChangeEvent>()
  /** The accepted colour, for `[(value)]`. */
  readonly valueChange = output<Color | null>()
  /** Every accepted edit of the text (the value changes only at commit points). */
  readonly inputValueChange = output<string>()

  private readonly parsed = colorReader(() => this.value() ?? undefined, "value", "color-field")
  private readonly parsedDefault = colorReader(
    () => this.defaultValue() ?? undefined,
    "defaultValue",
    "color-field",
  )
  /** @internal */
  protected readonly src: ColorFieldSource = {
    value: () => (this.value() === null ? null : this.parsed()),
    defaultValue: () => (this.defaultValue() === null ? null : (this.parsedDefault() ?? null)),
    format: () => this.format(),
    alpha: () => this.alpha(),
    colorSpace: () => this.colorSpace(),
    disabled: () => this.field.disabled(),
    readOnly: () => this.field.readonly(),
    locale: () => this.locale(),
    dir: () => this.dir(),
    messages: () => this.messages(),
    form: () => this.form(),
    onValueChange: (c, details) => {
      let cancelled = false
      this.valueChangeDetails.emit({
        value: c,
        details: {
          ...details,
          cancel: () => {
            cancelled = true
            details.cancel()
          },
        },
      })
      if (!cancelled) this.valueChange.emit(c)
    },
    onInputValueChange: (t) => this.inputValueChange.emit(t),
    inputProps: () => ({}),
  }
}

/** The text input: free text until Enter, blur or a flush. */
@Directive({ selector: "input[rindColorFieldInput]", exportAs: "rindColorFieldInput" })
export class ColorFieldInput {
  readonly id = input<string>()

  constructor() {
    const root = injectColorField("Input")
    const env = injectEnvironment()
    const binding = injectFieldControl()
    const el: HTMLInputElement = inject(ElementRef).nativeElement
    root.inputEl.value = el
    const controlId = () => this.id() ?? binding?.().controlId ?? String(root.api().input()["id"])
    const handlers = {
      // Devices that do not cancel `beforeinput` (Android composition): checked again here.
      onInput: (e: Event) => {
        const target = e.currentTarget as HTMLInputElement
        const text = target.value
        if (acceptColorText(text, root.fmt(), root.withAlpha())) root.send({ type: "INPUT", text })
        else target.value = root.api().text
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.defaultPrevented) return
        const event = colorFieldKeyEvent(describeKey(e, env), root.state().dirty)
        if (!event) return
        // Escape reverts a dirty draft only: the layer around stays open (handled Escape).
        if (event.type === "ESCAPE") e.preventDefault()
        root.send(event)
      },
      onFocusIn: () => root.focused.set(true),
      onFocusOut: () => {
        root.focused.set(false)
        root.send({ type: "BLUR" })
      },
    }
    bindProps(
      () =>
        joinHandlers({ ...root.api().input(), ...root.inputExtra(), id: controlId() }, handlers),
      { owns: ["id"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      // The resulting text is checked before it applies.
      const onBeforeInput = (e: Event) => {
        const ie = e as InputEvent
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        const pasted = ie.inputType === "insertFromPaste" || ie.inputType === "insertFromDrop"
        if (!ie.inputType.startsWith("insert") || ie.data === null) return
        const data = pasted ? ie.data.trim() : ie.data
        const next = el.value.slice(0, start) + data + el.value.slice(end)
        if (acceptColorText(next, root.fmt(), root.withAlpha())) {
          if (pasted && data !== ie.data) {
            e.preventDefault()
            root.send({ type: "INPUT", text: next })
          }
          return
        }
        e.preventDefault()
      }
      el.addEventListener("beforeinput", onBeforeInput)
      destroy.onDestroy(() => el.removeEventListener("beforeinput", onBeforeInput))
      if (binding) {
        const id = untracked(controlId)
        destroy.onDestroy(
          binding().register(
            {
              id,
              labelable: true,
              focus: (m) => void focusSafely(el, env, "programmatic", m),
              validityElement: () => root.hiddenInput(),
              value: () => root.current(),
            },
            id,
          ),
        )
      }
    })
  }
}

/** The Color Field's parts (its Label, Description and ErrorMessage are the Field's). Internal. */
export const ColorField = [ColorFieldRoot, ColorFieldInput] as const

// --- The Color Picker's channel inputs ---

/**
 * The picker's hex or CSS input (a Color Field bound to the picker): `<div
 * rindColorPickerChannelInput channel="hex">`; its `aria-label` names the input. Internal to
 * the Color Picker (exported there as `ColorPickerChannelInput`).
 */
@Component({
  selector:
    "[rindColorPickerChannelInput][channel=hex], [rindColorPickerChannelInput][channel=css]",
  exportAs: "rindColorPickerChannelInput",
  imports: [RindProps, ColorFieldInput],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [FieldRoot],
  providers: [
    { provide: COLOR_FIELD, useExisting: forwardRef(() => ColorPickerColorInput) },
    {
      provide: FIELD_HOST,
      useValue: { scope: COLOR_PICKER_SCOPE, rootPart: colorFieldPart("root") },
    },
  ],
  template: `<input rindColorFieldInput /><input #hidden [rindProps]="hiddenProps()" />`,
})
export class ColorPickerColorInput extends ColorFieldBase {
  /** `hex` or `css`: a Color Field. */
  readonly channel = input.required<"hex" | "css">()
  /** Accept and show 8-digit hex (default: when the colour has alpha below 1). */
  readonly alpha = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })

  private readonly binding = (() => {
    const b = injectColorBinding()
    if (!b) throw new Error("rindColorPickerChannelInput must be inside rindColorPickerRoot")
    return b
  })()
  private readonly label =
    inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
  /** @internal */
  protected readonly src: ColorFieldSource = {
    value: () => this.binding.color(),
    defaultValue: () => null,
    format: () => this.channel(),
    alpha: () => this.alpha() ?? this.binding.color().alpha < 1,
    colorSpace: () => undefined,
    disabled: () => this.binding.disabled(),
    readOnly: () => this.binding.readOnly(),
    locale: () => undefined,
    dir: () => undefined,
    messages: () => this.binding.messages(),
    form: () => undefined,
    onValueChange: (c) => {
      if (!c) return
      this.binding.set(c, "INPUT", untracked(this.channel))
      this.binding.commit("INPUT")
    },
    onInputValueChange: () => {},
    inputProps: () => ({
      "aria-label": this.label ?? this.binding.messages().formatName(this.channel()),
    }),
  }

  constructor() {
    super()
    bindProps(() => ({}), { owns: ["alpha", "aria-label", "channel"] })
  }
}

const CHANNEL_DEFAULT = makeColor("hsb", [0, 100, 100])

/**
 * The picker's input for one channel (a Number Input bound to it): `<div
 * rindColorPickerChannelInput channel="hue">`. Internal to the Color Picker.
 */
@Component({
  selector: "[rindColorPickerChannelInput]:not([channel=hex]):not([channel=css])",
  exportAs: "rindColorPickerChannelInput",
  imports: [RindProps, NumberInputInput],
  encapsulation: ViewEncapsulation.None,
  providers: [
    { provide: NUMBER_INPUT_TOKEN, useExisting: forwardRef(() => ColorPickerChannelNumberInput) },
    {
      provide: FIELD_HOST,
      useValue: { scope: COLOR_PICKER_SCOPE, rootPart: channelInputNaming.part("root") },
    },
  ],
  template: `<input rindNumberInputInput /><input #hidden [rindProps]="hiddenProps()" />`,
})
export class ColorPickerChannelNumberInput extends NumberInputRoot {
  /** A colour channel. */
  readonly channel = input.required<ColorChannel>()

  private readonly binding = (() => {
    const b = injectColorBinding()
    if (!b) throw new Error("rindColorPickerChannelInput must be inside rindColorPickerRoot")
    return b
  })()
  private readonly label =
    inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
  // The colour value of the channel (Echo rule, hue memory).
  private readonly colorValue = injectMachine(colorValueMachine, () => this.colorProps(), {})
  private readonly colorProps = () => {
    const first = untracked(this.binding.color)
    const channel = untracked(this.channel)
    return {
      value: this.binding.color(),
      defaultValue: undefined,
      space:
        channel === "alpha" || withChannel(first, channel, 0).space === first.space
          ? first.space
          : channel === "red" || channel === "green" || channel === "blue"
            ? ("rgb" as const)
            : channel === "lightness"
              ? ("hsl" as const)
              : ("hsb" as const),
      fallback: CHANNEL_DEFAULT,
      onValueChange: (c: Color) => this.binding.set(c, "INPUT", untracked(this.channel)),
      onValueCommit: () => this.binding.commit("INPUT"),
    }
  }
  private readonly working = () => {
    const view = this.colorValue.view()
    return workingOf(
      this.colorProps(),
      view.context,
      colorValueOf(this.colorProps(), view.values.value),
    )
  }
  private readonly numbers = computed(() =>
    colorChannelFieldProps(this.working(), this.channel(), this.colorValue.view().context.memory),
  )
  private readonly hostSource: NumberInputSource = {
    naming: channelInputNaming,
    value: () => this.numbers().value,
    min: () => this.numbers().min,
    max: () => this.numbers().max,
    step: () => this.numbers().step,
    largeStep: () => this.numbers().largeStep,
    formatOptions: () => this.numbers().formatOptions,
    commitBehavior: () => this.numbers().commitBehavior,
    disabled: () => this.binding.disabled(),
    readOnly: () => this.binding.readOnly(),
    locale: () => this.binding.locale(),
    inputProps: () => ({
      "aria-label": this.label ?? this.binding.messages().channelName(this.channel()),
    }),
    // A colour always has every channel: an empty commit is refused (the text returns).
    onValueChange: (v) => {
      if (v === null) return
      this.colorValue.send({
        type: "SET",
        color: withChannel(
          untracked(this.working),
          untracked(this.channel),
          v,
          untracked(this.colorValue.view).context.memory,
        ),
        reason: "INPUT",
      })
    },
    onValueCommit: (_v, d) => this.colorValue.send({ type: "COMMIT", reason: String(d.reason) }),
  }

  constructor() {
    super()
    bindProps(
      () => ({
        "data-channel": this.numbers()["data-channel"],
        style: colorVariables(this.working()),
      }),
      { owns: ["aria-label", "channel"] },
    )
  }

  /** @internal */
  protected override source(): NumberInputSource {
    return this.hostSource
  }
}
