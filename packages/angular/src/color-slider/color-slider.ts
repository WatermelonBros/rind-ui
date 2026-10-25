// Color Slider parts (design §5): a Slider bound to one channel of a colour. The colour value
// (Echo rule, hue memory, commits) is the shared colour-value machine; every Slider part is
// the Slider's own, with the binding's data attributes and appearance. Internal: the Color
// Picker's Channel Slider is this component bound to the picker's colour.
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
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
} from "@angular/core"
import {
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorCommitDetails,
  type ColorNameProp,
  type ColorSpace,
  colorValueMachine,
  colorValueOf,
  getChannel,
  type MessageOverrides,
  makeColor,
  type PartProps,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  COLOR_PICKER_SCOPE,
  type ColorSliderMessages,
  channelSliderNaming,
  colorSliderConnect,
  colorSliderMessages,
  colorSliderSpace,
  colorVariables,
} from "@rind-ui/core/internal"
import { bindProps } from "../bind-props"
import { injectColorBinding } from "../color-binding"
import { colorReader } from "../color-input"
import { TransparencyGridBase } from "../color-swatch/color-swatch"
import { injectMachine } from "../inject-machine"
import { injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"
import {
  SLIDER_HOST,
  SLIDER_THUMB_TEMPLATE,
  SliderControl,
  SliderDescription,
  SliderLabel,
  SliderRoot,
  type SliderSource,
  SliderThumbBase,
  SliderTrack,
} from "../slider/slider"

export interface ColorSliderChangeEvent {
  readonly value: Color
  readonly details: ColorChangeDetails
}

const COLOR_SLIDER = new InjectionToken<ColorSliderRoot>("rind-ui.color-slider")

function injectColorSlider(part: string): ColorSliderRoot {
  const root = inject(COLOR_SLIDER, { optional: true })
  if (!root) throw new Error(`rindColorSlider${part} must be inside rindColorSliderRoot`)
  return root
}

const DEFAULT = makeColor("hsb", [0, 100, 100])

/**
 * One channel of a colour edited with a Slider whose track is the channel's gradient:
 * `<div rindColorSliderRoot channel="hue">` with the Slider's parts under colour names. Internal.
 */
@Directive({
  selector: "[rindColorSliderRoot], [rindColorPickerChannelSlider]",
  exportAs: "rindColorSliderRoot",
  hostDirectives: [SliderRoot],
  providers: [
    { provide: COLOR_SLIDER, useExisting: forwardRef(() => ColorSliderRoot) },
    { provide: SLIDER_HOST, useFactory: () => ({ naming: channelSliderNaming, source: {} }) },
  ],
})
export class ColorSliderRoot {
  /** The edited channel: red, green, blue, hue, saturation, lightness, brightness or alpha. */
  readonly channel = input.required<ColorChannel>()
  /** The colour (`[(value)]`). */
  readonly value = input<string | Color>()
  /** Default `hsb(0, 100%, 100%)`. */
  readonly defaultValue = input<string | Color>()
  /** The working space. Default: the colour's when it has the channel. */
  readonly colorSpace = input<ColorSpace>()
  /** Replaces the colour name in the value text. */
  readonly colorName = input<ColorNameProp>()
  /** Channel names, value text and colour words. */
  readonly messages = input<MessageOverrides<ColorSliderMessages>>()
  readonly orientation = input<"horizontal" | "vertical">("horizontal")
  readonly locale = input<string>()
  readonly dir = input<"ltr" | "rtl">()
  /** The submitted field name. */
  readonly name = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Each applied change, in the space of the colour you passed; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ColorSliderChangeEvent>()
  /** The accepted colour, for `[(value)]`. */
  readonly valueChange = output<Color>()
  /** Once at the end of each interaction that changed the colour. */
  readonly valueCommit = output<{ value: Color; details: ColorCommitDetails }>()

  /** @internal The binding's data attributes, on every part. */
  readonly data: Signal<PartProps>
  /** @internal */
  readonly trackStyle: Signal<PartProps>
  /** @internal */
  readonly thumbStyle: Signal<PartProps>
  /** @internal A Label is rendered (it names the slider). */
  readonly labelled = signal(false)

  constructor() {
    const binding = injectColorBinding()
    const loc = injectLocale(
      () => this.locale() ?? binding?.locale(),
      () => this.dir() ?? binding?.dir(),
    )
    const messages = injectMessages("color-slider", colorSliderMessages, () => {
      if (!binding) return this.messages()
      const m = binding.messages()
      return { ...m, valueText: m.sliderValueText, ...this.messages() }
    })
    const value = colorReader(() => this.value(), "value", "color-slider")
    const defaultValue = colorReader(() => this.defaultValue(), "defaultValue", "color-slider")
    const own = () => (binding ? binding.color() : value())
    // The working space, read once (the channel and the first colour decide it).
    let space: ColorSpace | undefined
    const spaceOf = () =>
      (space ??= untracked(() =>
        colorSliderSpace(this.channel(), this.colorSpace(), own() ?? defaultValue()),
      ))
    const machineProps = () => ({
      value: own(),
      defaultValue: defaultValue(),
      space: spaceOf(),
      fallback: DEFAULT,
      onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
        // A form reset restores the default without a callback (as every form control).
        if (d.reason === "RESET") return
        if (binding) {
          binding.set(c, "SLIDER", untracked(this.channel))
          return
        }
        const reason = (d.event as { reason?: string }).reason ?? d.reason
        let cancelled = false
        this.valueChangeDetails.emit({
          value: c,
          details: {
            reason,
            space: spaceOf(),
            cancel: () => {
              cancelled = true
              d.cancel()
            },
          },
        })
        if (!cancelled) this.valueChange.emit(c)
      },
      onValueCommit: (c: Color, d: ColorCommitDetails) => {
        if (binding) binding.commit("SLIDER")
        else this.valueCommit.emit({ value: c, details: d })
      },
    })
    const { view, send } = injectMachine(colorValueMachine, machineProps, {})
    const color = () =>
      workingOf(machineProps(), view().context, colorValueOf(machineProps(), view().values.value))
    const api = computed(() =>
      colorSliderConnect({
        color: color(),
        channel: this.channel(),
        memory: view().context.memory,
        orientation: this.orientation(),
        dir: loc().dir,
        messages: messages(),
        locale: loc().locale,
        colorName: this.colorName() ?? binding?.colorName(),
      }),
    )
    this.data = computed(() => api().data)
    this.trackStyle = computed(() => ({ style: api().trackStyle }))
    this.thumbStyle = computed(() => ({ style: api().thumbStyle }))
    const source: SliderSource = {
      value: () => api().slider.value,
      // What the hidden input's value attribute and a form reset show.
      defaultValue: () => {
        const def = defaultValue()
        return def ? getChannel(def, this.channel()) : undefined
      },
      min: () => api().slider.min,
      max: () => api().slider.max,
      step: () => api().slider.step,
      largeStep: () => api().slider.largeStep,
      orientation: () => this.orientation(),
      disabled: () => binding?.disabled() ?? this.disabled(),
      readOnly: () => binding?.readOnly() ?? this.readonly(),
      name: () => this.name(),
      dir: () => loc().dir,
      locale: () => loc().locale,
      messages: () => ({
        valueText: ({ value: v }: { value: number }) => api().valueText(v),
        // Unlabelled: the thumb is named by the channel.
        thumbLabel: () => (this.labelled() ? "" : api().channelName),
      }),
      onValueChange: (n, d) =>
        // The Slider's form reset is the colour's: every channel back to the default.
        d.event.type === "RESET"
          ? send({ type: "RESET" })
          : send({
              type: "SET",
              color: withChannel(
                untracked(color),
                untracked(this.channel),
                Number(n),
                untracked(view).context.memory,
              ),
              reason: "SLIDER",
            }),
      onValueCommit: (_n, d) => send({ type: "COMMIT", reason: String(d.reason) }),
    }
    inject(SLIDER_HOST, { self: true }).source = source
    const labelledBy = inject(new HostAttributeToken("aria-labelledby"), { optional: true })
    bindProps(
      () => {
        const a = api()
        return {
          ...a.data,
          style: { ...a.surfaceStyle, ...colorVariables(color()) },
          // Unlabelled: the group is named by the channel too, so it can be found by name.
          ...(this.labelled() || labelledBy !== null ? {} : { "aria-label": a.channelName }),
        }
      },
      {
        owns: ["channel", "colorname", "colorspace", "defaultvalue", "messages", "value"],
      },
    )
  }
}

/** A Slider part with the binding's data attributes (and its own appearance). */
function injectBound(part: string, extra: (root: ColorSliderRoot) => PartProps = () => ({})) {
  const root = injectColorSlider(part)
  bindProps(() => ({ ...root.data(), ...extra(root) }))
  return root
}

@Directive({
  selector: "[rindColorSliderLabel], [rindColorPickerChannelSliderLabel]",
  exportAs: "rindColorSliderLabel",
  hostDirectives: [SliderLabel],
})
export class ColorSliderLabel {
  constructor() {
    const root = injectBound("Label")
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => root.labelled.set(true))
    inject(DestroyRef).onDestroy(() => root.labelled.set(false))
  }
}

/** The ValueText is the Slider's (its selector covers these names); here only the data. */
@Directive({
  selector: "[rindColorSliderValueText], [rindColorPickerChannelSliderValueText]",
})
export class ColorSliderValueText {
  constructor() {
    injectBound("ValueText")
  }
}

@Directive({
  selector: "[rindColorSliderControl], [rindColorPickerChannelSliderControl]",
  exportAs: "rindColorSliderControl",
  hostDirectives: [SliderControl],
})
export class ColorSliderControl {
  constructor() {
    injectBound("Control")
  }
}

@Directive({
  selector: "[rindColorSliderTrack], [rindColorPickerChannelSliderTrack]",
  exportAs: "rindColorSliderTrack",
  hostDirectives: [SliderTrack],
})
export class ColorSliderTrack {
  constructor() {
    injectBound("Track", (root) => root.trackStyle())
  }
}

@Directive({
  selector: "[rindColorSliderDescription], [rindColorPickerChannelSliderDescription]",
  exportAs: "rindColorSliderDescription",
  hostDirectives: [SliderDescription],
})
export class ColorSliderDescription {
  constructor() {
    injectBound("Description")
  }
}

/** The one thumb and its range input. */
@Component({
  selector: "[rindColorSliderThumb], [rindColorPickerChannelSliderThumb]",
  exportAs: "rindColorSliderThumb",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: SLIDER_THUMB_TEMPLATE,
})
export class ColorSliderThumb extends SliderThumbBase {
  readonly index = () => 0
  constructor() {
    super()
    injectBound("Thumb", (root) => root.thumbStyle())
  }
}

/** A checkerboard under the alpha track. */
@Directive({
  selector: "[rindColorSliderTransparencyGrid]",
  exportAs: "rindColorSliderTransparencyGrid",
})
export class ColorSliderTransparencyGrid extends TransparencyGridBase {
  constructor() {
    const root = injectColorSlider("TransparencyGrid")
    // The picker's scope: a consumer attribute never moves the part out of it.
    super(COLOR_PICKER_SCOPE, () => root.data())
  }
}

/** The Color Slider's parts. Internal. */
export const ColorSlider = [
  ColorSliderRoot,
  ColorSliderLabel,
  ColorSliderValueText,
  ColorSliderControl,
  ColorSliderTrack,
  ColorSliderThumb,
  ColorSliderDescription,
  ColorSliderTransparencyGrid,
] as const
