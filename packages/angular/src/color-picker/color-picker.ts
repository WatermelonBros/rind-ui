// Color Picker parts (design §8): the coordinator machine owns the colour, the format and the
// open state; the Popover is its controlled child (re-scoped to `color-picker`), and every
// colour child (Area, Channel Slider, Channel Input, Swatch Group, Swatch) is the component of
// its own, bound to the picker's colour. Wiring only.
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
  type Color,
  type ColorChangeDetails,
  type ColorFormat,
  type ColorInput,
  type ColorNameProp,
  type ColorPickerFormat,
  type ColorPickerMessages,
  type ColorPickerReason,
  colorPickerConnect,
  colorPickerMachine,
  colorPickerMessages,
  createFlushRegistry,
  type FocusTarget,
  focusAttrs,
  focusSafely,
  formatColor,
  isEyeDropperSupported,
  type MessageOverrides,
  nextFormat,
  type PartProps,
  PICKER_FORMATS,
  type PositioningProps,
  partId,
  pickerValueOf,
  pickerWorking,
  pickScreenColor,
} from "@rind-ui/core"
import { COLOR_PICKER_SCOPE } from "@rind-ui/core/internal"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { COLOR_BINDING, COLOR_FLUSH, type ColorBinding } from "../color-binding"
import { colorReader } from "../color-input"
import { ColorSwatchBase, TransparencyGridBase } from "../color-swatch/color-swatch"
import { FIELD_HOST, FieldControlBoundary, injectFieldControl } from "../field/context"
import { FieldRoot } from "../field/field"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import {
  POPOVER_OVERRIDE,
  POPOVER_SCOPE,
  PopoverAnchor,
  PopoverContent,
  type PopoverOverride,
  PopoverRoot,
  PopoverTrigger,
} from "../popover/popover"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

export interface ColorPickerState {
  readonly color: Color
  readonly format: ColorPickerFormat
  readonly open: boolean
  readonly inline: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface ColorPickerChangeDetails extends ColorChangeDetails<ColorPickerReason> {
  /** The colour in the current format. */
  readonly valueAsString: string
  /** The channel an input or slider changed. */
  readonly channel?: string | undefined
}

const PICKER = new InjectionToken<ColorPickerRoot>("rind-ui.color-picker")

function injectPicker(part: string): ColorPickerRoot {
  const root = inject(PICKER, { optional: true })
  if (!root) throw new Error(`rindColorPicker${part} must be inside rindColorPickerRoot`)
  return root
}

/** Inside the Trigger: the ValueSwatch is decorative (the Trigger's name carries the colour). */
const IN_TRIGGER = new InjectionToken<boolean>("rind-ui.color-picker-in-trigger")

/** The default format of the first colour given: a hex string `hex`, otherwise its space. */
function firstFormat(input: ColorInput | undefined, color: Color | undefined): ColorPickerFormat {
  if (typeof input === "string" && input.trim().startsWith("#")) return "hex"
  return color ? color.space : "hex"
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A colour picker: a trigger and a popover (or an inline panel) bound to one colour:
 * `<div rindColorPickerRoot [(value)]="fill">` with a Label, a Control holding the Trigger and
 * the ValueText, and, in `<ng-template rindColorPickerPortal>`, a Positioner holding the
 * Content. Inline (`inline`, read once): the Content in place, no Portal or Positioner.
 */
@Component({
  selector: "[rindColorPickerRoot]",
  exportAs: "rindColorPickerRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    { directive: FieldRoot, inputs: ["disabled", "readonly", "required", "id"] },
    PopoverRoot,
  ],
  providers: [
    { provide: PICKER, useExisting: forwardRef(() => ColorPickerRoot) },
    { provide: FIELD_HOST, useFactory: () => ({ scope: COLOR_PICKER_SCOPE }) },
    { provide: POPOVER_SCOPE, useValue: COLOR_PICKER_SCOPE },
    { provide: POPOVER_OVERRIDE, useFactory: () => ({ source: {} }) },
    { provide: COLOR_BINDING, useFactory: () => inject(ColorPickerRoot).binding },
    { provide: COLOR_FLUSH, useFactory: () => inject(ColorPickerRoot).registry },
  ],
  template: `<ng-content />@if (!hiddenPart()) {<input #hidden [rindProps]="hiddenProps()" />}`,
})
export class ColorPickerRoot {
  /** The colour (`[(value)]`). */
  readonly value = input<ColorInput>()
  /** Default `#000000`. */
  readonly defaultValue = input<ColorInput>()
  /** The shown format (`[(format)]`). */
  readonly format = input<ColorPickerFormat>()
  readonly defaultFormat = input<ColorPickerFormat>()
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** The content in place: no Popover, no layer, no positioning. Read once. */
  readonly inline = input(false, { transform: booleanAttribute })
  readonly closeOnSelect = input(false, { transform: booleanAttribute })
  readonly modal = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** The Popover's positioning: side, align, offsets, flip, shift, size, arrow and mode. */
  readonly positioning = input<PositioningProps>()
  /** Where focus goes once the Popover is placed: a function, or the overlay's rule. */
  readonly initialFocus = input<(() => FocusTarget) | null>()
  /** Elements whose presses and focus count as inside the Popover (a toast region). */
  readonly persistentElements = input<() => readonly Element[]>()
  /** The submitted field name. */
  readonly name = input<string>()
  /** The id of the form the hidden input belongs to. */
  readonly form = input<string>()
  /** The submitted text's format (default the canonical hex). */
  readonly formFormat = input<ColorFormat>()
  /** A fixed name or a function replacing the computed colour name. */
  readonly colorName = input<ColorNameProp>()
  /** Formats the colour name and the numbers. Default: the provider's. */
  readonly locale = input<string>()
  /** Reading direction; mirrors the area and sliders. Default: the provider's. */
  readonly dir = input<"ltr" | "rtl">()
  readonly messages = input<MessageOverrides<ColorPickerMessages>>()
  /** Marks the picker invalid (`data-invalid`, the Field's error state). */
  readonly invalid = input(false, { transform: booleanAttribute })
  /** Every change proposes a colour; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<{ value: Color; details: ColorPickerChangeDetails }>()
  /** The accepted colour, for `[(value)]`. */
  readonly valueChange = output<Color>()
  /** Once at the end of each interaction that changed the colour. */
  readonly valueCommit = output<{ value: Color; details: { readonly reason: ColorPickerReason } }>()
  /** The shown format, for `[(format)]`. */
  readonly formatChange = output<ColorPickerFormat>()
  readonly openChangeDetails = output<{ open: boolean; details: { readonly reason: string } }>()
  /** The visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()

  /** @internal */
  readonly field = inject(FieldRoot, { self: true })
  /** @internal */
  readonly instance = this.field.instance
  /** @internal */
  readonly api: Signal<ReturnType<typeof colorPickerConnect>>
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof colorPickerMachine>>["send"]
  /** @internal */
  readonly binding: ColorBinding
  /** @internal */
  readonly registry = createFlushRegistry()
  /** @internal */
  readonly texts: Signal<ColorPickerMessages>
  /** @internal */
  readonly localeName: () => string
  /** @internal */
  readonly labelRendered = signal(false)
  /** @internal */
  readonly hiddenPart = signal(false)
  /** @internal */
  readonly triggerEl: { value: HTMLElement | null } = { value: null }
  /** @internal Read once: the content is in place. */
  readonly isInline: () => boolean
  /** The picker's state, for the template (`#p="rindColorPickerRoot"`, `p.state()`). */
  readonly state: Signal<ColorPickerState>
  /** @internal */
  protected readonly hiddenProps: Signal<PartProps>
  private readonly hiddenRef = viewChild<ElementRef<HTMLInputElement>>("hidden")

  constructor() {
    const loc = injectLocale(
      () => this.locale(),
      () => this.dir(),
    )
    this.localeName = () => loc().locale
    this.texts = injectMessages("color-picker", colorPickerMessages, () => this.messages())
    const value = colorReader(() => this.value(), "value", "color-picker")
    const defaultValue = colorReader(() => this.defaultValue(), "defaultValue", "color-picker")
    let initialFormat: ColorPickerFormat | undefined
    const startFormat = () =>
      (initialFormat ??= untracked(
        () =>
          this.defaultFormat() ??
          firstFormat(this.value() ?? this.defaultValue(), value() ?? defaultValue()),
      ))
    let inline: boolean | undefined
    const isInline = () => (inline ??= untracked(this.inline))
    this.isInline = isInline
    let latestFormat: ColorPickerFormat | undefined
    const disabled = () => this.field.disabled()
    const readOnly = () => this.field.readonly()
    const machineProps = () => ({
      value: value(),
      defaultValue: defaultValue(),
      format: this.format(),
      defaultFormat: startFormat(),
      open: isInline() ? undefined : this.open(),
      defaultOpen: this.defaultOpen() ?? false,
      inline: isInline(),
      disabled: disabled(),
      readOnly: readOnly(),
      closeOnSelect: this.closeOnSelect(),
      onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
        const e = d.event as { reason?: ColorPickerReason; channel?: string }
        const reason = e.reason ?? (d.reason === "RESET" ? "RESET" : "INPUT")
        let cancelled = false
        this.valueChangeDetails.emit({
          value: c,
          details: {
            reason,
            space: c.space,
            valueAsString: formatColor(c, latestFormat ?? startFormat()),
            channel: e.channel,
            cancel: () => {
              cancelled = true
              d.cancel()
            },
          },
        })
        if (!cancelled) this.valueChange.emit(c)
      },
      onValueCommit: (c: Color, d: { readonly reason: ColorPickerReason }) =>
        this.valueCommit.emit({ value: c, details: d }),
      onFormatChange: (f: ColorPickerFormat) => this.formatChange.emit(f),
      onOpenChange: (o: boolean, d: { reason: string; event: unknown }) => {
        const event = d.event as { type: string; reason?: string }
        // A transition's own reason ("select", "api") wins; else the Popover's, carried by the event.
        const reason = d.reason !== event.type ? d.reason : (event.reason ?? d.reason)
        this.openChangeDetails.emit({ open: o, details: { reason } })
        this.openChange.emit(o)
      },
    })
    const { view, send } = injectMachine(colorPickerMachine, machineProps, {})
    this.send = send
    const format = () => view().values.format
    const color = () => pickerWorking(machineProps(), view().context, view().values.value)
    const open = () => view().values.open === true
    this.api = computed(() => {
      latestFormat = format()
      const id = this.instance()
      return colorPickerConnect({
        instance: id,
        color: color(),
        format: format(),
        open: open(),
        inline: isInline(),
        disabled: disabled(),
        readOnly: readOnly(),
        invalid: this.invalid(),
        dragging: false,
        messages: this.texts(),
        locale: loc().locale,
        colorName: this.colorName(),
        ids: {
          control: partId("color-picker", id, "control"),
          trigger: partId("color-picker", id, "trigger"),
          label: partId("color-picker", id, "label"),
          content: partId("color-picker", id, "content"),
          hiddenInput: partId("color-picker", id, "hidden-input"),
        },
        labelRendered: this.labelRendered(),
        name: this.name(),
        form: this.form(),
        required: this.field.required(),
        formFormat: this.formFormat(),
        defaultValue:
          defaultValue() ?? pickerValueOf({ ...machineProps(), value: undefined }, undefined),
      })
    })
    this.state = computed(() => ({
      color: color(),
      format: format(),
      open: open(),
      inline: isInline(),
      disabled: disabled(),
      readOnly: readOnly(),
    }))
    this.binding = {
      color,
      disabled,
      readOnly,
      dir: () => loc().dir,
      locale: () => loc().locale,
      colorName: () => this.colorName(),
      messages: () => this.texts(),
      set: (c, reason, channel) =>
        send({ type: "COLOR.SET", color: c, reason, ...(channel ? { channel } : {}) }),
      commit: (reason) => send({ type: "COLOR.COMMIT", reason }),
    }
    const popover: PopoverOverride = {
      id: () => this.instance(),
      open,
      onOpenChange: (next, d) => {
        if (next) {
          send({ type: "OPEN", reason: d.reason })
          return
        }
        // Every pending draft commits first (react-spectrum#9748), then the close.
        this.registry.flushAll()
        send({ type: "CLOSE", reason: d.reason })
      },
      disabled,
      modal: () => this.modal(),
      positioning: () => this.positioning(),
      initialFocus: () => this.initialFocus(),
      persistentElements: () => this.persistentElements()?.() ?? [],
      inline: isInline,
    }
    inject(POPOVER_OVERRIDE, { self: true }).source = popover
    inject(FIELD_HOST, { self: true }).invalid = () => this.invalid()
    this.hiddenProps = computed(() => this.api().hiddenInput())
    bindProps(() => ({ dir: loc().dir, ...this.api().root() }), {
      owns: [
        "closeonselect",
        "colorname",
        "defaultformat",
        "defaultopen",
        "defaultvalue",
        "dir",
        "form",
        "format",
        "formformat",
        "initialfocus",
        "inline",
        "invalid",
        "locale",
        "messages",
        "modal",
        "name",
        "open",
        "persistentelements",
        "positioning",
        "value",
      ],
    })
    injectHiddenSync(this, () => this.hiddenRef()?.nativeElement ?? null)
  }
}

/** The hidden input's value mirrors the colour; reset and autofill. Call it in a constructor. */
function injectHiddenSync(picker: ColorPickerRoot, el: () => HTMLInputElement | null) {
  if (inject(PLATFORM_ID) !== "browser") return
  const destroy = inject(DestroyRef)
  // The value property mirrors the colour after every commit (hidden-form-input); a reset
  // restores the default; a native change we did not make (autofill) is adopted.
  afterEveryRender(() => {
    const input = el()
    const value = untracked(picker.api).formValue
    if (input && input.value !== value) input.value = value
  })
  afterNextRender(() => {
    const input = el()
    const owner = input?.form
    const onReset = () => picker.send({ type: "RESET" })
    const onChange = (e: Event) => {
      if (e.isTrusted) picker.send({ type: "ADOPT", text: (e.target as HTMLInputElement).value })
    }
    owner?.addEventListener("reset", onReset)
    input?.addEventListener("change", onChange)
    destroy.onDestroy(() => {
      owner?.removeEventListener("reset", onReset)
      input?.removeEventListener("change", onChange)
    })
  })
}

/** Places the hidden input: `<input rindColorPickerHiddenInput>` (it replaces the automatic one). */
@Directive({
  selector: "input[rindColorPickerHiddenInput]",
  exportAs: "rindColorPickerHiddenInput",
})
export class ColorPickerHiddenInput {
  constructor() {
    const picker = injectPicker("HiddenInput")
    const el: HTMLInputElement = inject(ElementRef).nativeElement
    picker.hiddenPart.set(true)
    inject(DestroyRef).onDestroy(() => picker.hiddenPart.set(false))
    bindProps(() => picker.api().hiddenInput())
    injectHiddenSync(picker, () => el)
  }
}

/** Names the Control, the Trigger and the content; a press focuses the Trigger. */
@Directive({ selector: "[rindColorPickerLabel]", exportAs: "rindColorPickerLabel" })
export class ColorPickerLabel {
  constructor() {
    const picker = injectPicker("Label")
    const env = injectEnvironment()
    // After the first render, as React's layout effect: the server HTML names by the default.
    if (inject(PLATFORM_ID) === "browser") {
      afterNextRender(() => picker.labelRendered.set(true))
      inject(DestroyRef).onDestroy(() => picker.labelRendered.set(false))
    }
    bindProps(() =>
      joinHandlers(picker.api().label(), {
        onMouseDown: (e: MouseEvent) => {
          // A pointer press focuses the Trigger (inline: the first text input) without a ring.
          e.preventDefault()
          const target =
            picker.triggerEl.value ??
            env.dom
              .getById(String(picker.api().inlineContent()["id"]))
              ?.querySelector<HTMLElement>("input")
          if (target) void focusSafely(target, env, "programmatic", "pointer")
        },
      }),
    )
  }
}

/** `role="group"`: the Popover's anchor. */
@Directive({
  selector: "[rindColorPickerControl]",
  exportAs: "rindColorPickerControl",
  hostDirectives: [PopoverAnchor],
})
export class ColorPickerControl {
  constructor() {
    const picker = injectPicker("Control")
    bindProps(() => {
      const own = picker.api().control()
      if (picker.isInline()) return own
      // The Popover finds its anchor by the anchor's own id: an `id` here would replace it.
      const { id: _anchorOwnsTheId, ...anchor } = own
      return anchor
    })
  }
}

/** Opens the content; named "Choose color, <colour>" and by the Label. */
@Directive({
  selector: "[rindColorPickerTrigger]",
  exportAs: "rindColorPickerTrigger",
  hostDirectives: [PopoverTrigger],
  providers: [{ provide: IN_TRIGGER, useValue: true }],
})
export class ColorPickerTrigger {
  constructor() {
    const picker = injectPicker("Trigger")
    const env = injectEnvironment()
    const binding = injectFieldControl()
    const el: HTMLElement = inject(ElementRef).nativeElement
    picker.triggerEl.value = el
    bindProps(() =>
      picker.isInline() ? absentProps("color-picker", picker.instance()) : picker.api().trigger(),
    )
    const destroy = inject(DestroyRef)
    destroy.onDestroy(() => {
      if (picker.triggerEl.value === el) picker.triggerEl.value = null
    })
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => {
      if (picker.isInline()) {
        if (process.env.NODE_ENV !== "production")
          console.warn(
            "[rind-ui] color-picker: an inline picker has no Trigger; it renders nothing",
          )
        return
      }
      if (!binding) return
      const id = String(picker.api().trigger()["aria-labelledby"] ?? "").split(" ")[0] ?? ""
      if (!id) return
      destroy.onDestroy(
        binding().register(
          {
            id,
            labelable: true,
            focus: (m) => void focusSafely(el, env, "programmatic", m),
            validityElement: () => null,
            value: () => picker.api().formValue,
          },
          id,
        ),
      )
    })
  }
}

/** The content: the Popover's, or (inline) a `role="group"` in place. Its controls are its own. */
@Directive({
  selector: "[rindColorPickerContent]",
  exportAs: "rindColorPickerContent",
  hostDirectives: [PopoverContent, FieldControlBoundary],
})
export class ColorPickerContent {
  constructor() {
    const picker = injectPicker("Content")
    const { statics } = bindProps(() => {
      const label = statics.get("aria-label")
      const labelledBy = statics.get("aria-labelledby")
      const name = picker.api().contentName({ label, labelledBy })
      const naming = {
        ...(name.label === undefined ? {} : { "aria-label": name.label }),
        ...(name.labelledBy === undefined ? {} : { "aria-labelledby": name.labelledBy }),
      }
      return picker.isInline() ? { ...picker.api().inlineContent(), ...naming } : naming
    })
  }
}

/** A Color Swatch (a colour to show, named by its colour name). */
@Directive({ selector: "[rindColorPickerSwatch]", exportAs: "rindColorPickerSwatch" })
export class ColorPickerSwatch extends ColorSwatchBase {
  constructor() {
    const picker = injectPicker("Swatch")
    super({ scope: COLOR_PICKER_SCOPE, part: "swatch" }, { messages: () => picker.texts() })
  }
}

/** The picker's colour as a swatch (decorative inside the Trigger). */
@Directive({ selector: "[rindColorPickerValueSwatch]", exportAs: "rindColorPickerValueSwatch" })
export class ColorPickerValueSwatch extends ColorSwatchBase {
  constructor() {
    const picker = injectPicker("ValueSwatch")
    super(
      { scope: COLOR_PICKER_SCOPE, part: "value-swatch" },
      { color: () => picker.binding.color(), messages: () => picker.texts() },
    )
    if (inject(IN_TRIGGER, { optional: true }))
      bindProps(() => ({ "aria-hidden": "true", role: "presentation" }))
  }
}

/** The colour in the current format: its content, or the text. Not a live region. */
@Component({
  selector: "[rindColorPickerValueText]",
  exportAs: "rindColorPickerValueText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ColorPickerValueText {
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const picker = injectPicker("ValueText")
    this.text = () => picker.api().valueText
    bindProps(() => picker.api().valueTextPart())
  }
}

/** `data-focus` / `data-focus-visible` for a picker-owned control, with its focus handlers. */
function injectFocusAttrs(): () => PartProps {
  const env = injectEnvironment()
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  return () => ({
    ...focusAttrs(focused(), modality()),
    onFocusIn: () => focused.set(true),
    onFocusOut: () => focused.set(false),
  })
}

/** Opens the browser's eye dropper; hidden where there is none (ark#2764). */
@Directive({
  selector: "[rindColorPickerEyeDropperTrigger]",
  exportAs: "rindColorPickerEyeDropperTrigger",
})
export class ColorPickerEyeDropperTrigger {
  constructor() {
    const picker = injectPicker("EyeDropperTrigger")
    const env = injectEnvironment(announcerCapability)
    const supported = signal(false)
    const focus = injectFocusAttrs()
    bindProps(() =>
      joinHandlers(picker.api().eyeDropperTrigger(supported()), focus(), {
        onClick: async () => {
          const hex = await pickScreenColor(globalThis.window)
          if (!hex) return
          picker.send({ type: "EYEDROPPER.RESULT", hex })
          env.announcer.announce({
            message: picker.texts().picked({ colorName: picker.api().colorName }),
            priority: "polite",
            key: `color-picker-${picker.instance()}`,
            lang: picker.localeName(),
          })
        },
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // After the first render: the server and the first client render agree (hidden).
    afterNextRender(() => supported.set(isEyeDropperSupported(globalThis.window)))
  }
}

/** A native select of the formats: `<select rindColorPickerFormatSelect>`. */
@Component({
  selector: "select[rindColorPickerFormatSelect]",
  exportAs: "rindColorPickerFormatSelect",
  encapsulation: ViewEncapsulation.None,
  template: `@for (f of formats; track f) {<option [value]="f" [attr.selected]="f === format() ? '' : null">{{ label(f) }}</option>}`,
})
export class ColorPickerFormatSelect {
  /** @internal */
  protected readonly formats = PICKER_FORMATS
  /** @internal */
  protected readonly format: () => ColorPickerFormat
  /** @internal */
  protected readonly label: (f: ColorPickerFormat) => string

  constructor() {
    const picker = injectPicker("FormatSelect")
    const el: HTMLSelectElement = inject(ElementRef).nativeElement
    const focus = injectFocusAttrs()
    this.format = () => picker.state().format
    this.label = (f) => picker.texts().formatOptions(f)
    bindProps(() =>
      joinHandlers(picker.api().formatSelect(), focus(), {
        onChange: (e: Event) =>
          picker.send({
            type: "FORMAT.SET",
            format: (e.currentTarget as HTMLSelectElement).value as ColorPickerFormat,
          }),
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The value is set as a property.
    afterEveryRender(() => {
      const f = untracked(this.format)
      if (el.value !== f) el.value = f
    })
  }
}

/** Cycles hex → rgb → hsl → hsb and announces the new format; its content, or the format. */
@Component({
  selector: "[rindColorPickerFormatTrigger]",
  exportAs: "rindColorPickerFormatTrigger",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ColorPickerFormatTrigger {
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const picker = injectPicker("FormatTrigger")
    const env = injectEnvironment(announcerCapability)
    const focus = injectFocusAttrs()
    this.text = () => picker.texts().formatOptions(picker.state().format)
    bindProps(() => {
      const m = picker.texts()
      const current = picker.state().format
      const next = nextFormat(current)
      return joinHandlers(
        {
          ...focus(),
          "data-scope": "color-picker",
          "data-part": "format-trigger",
          "data-instance": picker.instance(),
          type: "button",
          "aria-label": m.formatTrigger({
            current: m.formatOptions(current),
            next: m.formatOptions(next),
          }),
          disabled: picker.state().disabled || undefined,
        },
        {
          onClick: () => {
            picker.send({ type: "FORMAT.SET", format: next })
            env.announcer.announce({
              message: m.formatChanged({ format: m.formatOptions(next) }),
              priority: "polite",
              key: `color-picker-format-${picker.instance()}`,
              lang: picker.localeName(),
            })
          },
        },
      )
    })
  }
}

/** Its content only while the picker's format is `format` (React renders nothing otherwise). */
@Directive({ selector: "[rindColorPickerView]", exportAs: "rindColorPickerView" })
export class ColorPickerView {
  /** The format this view is for. */
  readonly format = input.required<ColorPickerFormat>()
  constructor() {
    const picker = injectPicker("View")
    bindProps(
      () =>
        picker.state().format === this.format()
          ? picker.api().view(this.format())
          : absentProps("color-picker", picker.instance()),
      { owns: ["format"] },
    )
  }
}

/** A decorative checkerboard filling its parent (under the alpha track, a swatch). */
@Directive({
  selector: "[rindColorPickerTransparencyGrid]",
  exportAs: "rindColorPickerTransparencyGrid",
})
export class ColorPickerTransparencyGrid extends TransparencyGridBase {
  constructor() {
    injectPicker("TransparencyGrid")
    // The picker's scope: a consumer attribute never moves the part out of it.
    super(COLOR_PICKER_SCOPE)
  }
}
