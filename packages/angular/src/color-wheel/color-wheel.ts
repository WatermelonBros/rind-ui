// Color Wheel (add-color-wheel): a hue ring. No machine of its own: the parts run the Angle Slider
// machine on the colour's hue and map each new hue back to a colour in the working space. A
// visually hidden range input is the one focusable slider; a hidden input submits the hex.
import {
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
  Renderer2,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  type AngleSliderEvent,
  type AngleSliderReason,
  angleSliderKeyEvent,
  angleSliderMachine,
  type ChangeDetails,
  type Color,
  type ColorInput,
  type ColorMemory,
  type ColorWheelMessages,
  colorWheelConnect,
  colorWheelMessages,
  colorWithHue,
  describeKey,
  focusSafely,
  hiddenFormInput,
  hueOf,
  isDragPress,
  type MessageOverrides,
  type Modality,
  makeColor,
  onRing,
  partId,
  pointerAngleSession,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { colorReader } from "../color-input"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"

/** The wheel's state, for the template (`#w="rindColorWheelRoot"`, `w.state()`). */
export interface ColorWheelRenderState {
  readonly color: Color
  /** The hue in degrees, [0, 360). */
  readonly hue: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

const COLOR_WHEEL = new InjectionToken<ColorWheelRoot>("rind-ui.color-wheel")

function injectColorWheel(part: string): ColorWheelRoot {
  const root = inject(COLOR_WHEEL, { optional: true })
  if (!root) throw new Error(`rindColorWheel${part} must be inside rindColorWheelRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))
const DEFAULT = makeColor("hsl", [0, 100, 50])
/** The ring's width when the Track sets no `--rind-color-wheel-thickness`. */
const THICKNESS = 30

/**
 * A hue ring: `<div rindColorWheelRoot [(value)]="accent">` with a Label, a Track holding the
 * Thumb, the Input (a visually hidden range input) and a Value; it adds the form's hex input.
 */
@Directive({
  selector: "[rindColorWheelRoot]",
  exportAs: "rindColorWheelRoot",
  providers: [{ provide: COLOR_WHEEL, useExisting: forwardRef(() => ColorWheelRoot) }],
})
export class ColorWheelRoot {
  /** Controlled colour (`[(value)]`). */
  readonly value = input<ColorInput>()
  /** Uncontrolled colour. Default `hsl(0 100% 50%)`. */
  readonly defaultValue = input<ColorInput>()
  /** The space the colour is emitted in. Default `hsl`. */
  readonly colorSpace = input<"hsl" | "hsb">()
  /** Degrees per step. Default 1. */
  readonly step = input(undefined, { transform: optionalNumber })
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep = input(undefined, { transform: optionalNumber })
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  readonly invalid = input(false, { transform: booleanAttribute })
  /** Submits the colour as hex. */
  readonly name = input<string>()
  /** The form's id, when outside it. */
  readonly form = input<string>()
  readonly messages = input<MessageOverrides<ColorWheelMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** Every change of the hue. */
  readonly valueChange = output<Color>()
  readonly valueChangeDetails = output<{
    value: Color
    details: ChangeDetails<AngleSliderEvent>
  }>()
  /** Once per interaction: a drag's release, a press, a key. */
  readonly valueCommit = output<{ value: Color; reason: AngleSliderReason }>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof colorWheelConnect>>
  /** @internal */
  readonly send: (event: AngleSliderEvent) => void
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"label">>
  /** @internal */
  readonly labelId: () => string
  /** @internal */
  readonly focused = signal(false)
  /** @internal */
  readonly press: (track: Element, e: PointerEvent) => void
  /** @internal */
  inputEl: HTMLInputElement | null = null
  /** @internal */
  hiddenEl: HTMLInputElement | null = null
  /** @internal */
  thumbEl: Element | null = null
  readonly state: Signal<ColorWheelRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment()
    const messages = injectMessages("color-wheel", colorWheelMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    this.registry = injectPartRegistry<"label">(() => ({ scope: "color-wheel", root: instance() }))
    const rendered = injectRenderedId(this.registry, "label")
    this.labelId = () => partId("color-wheel", instance(), "label")
    const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
    const ariaLabel = read("aria-label") ?? undefined
    const ariaLabelledBy = read("aria-labelledby") ?? undefined
    const value = colorReader(() => this.value(), "value", "color-wheel")
    const defaultValue = colorReader(() => this.defaultValue(), "defaultValue", "color-wheel")
    // The uncontrolled colour, from the first defaultValue (read when first needed: inputs are
    // set after the constructor); a controlled `value` wins.
    const inner = signal<Color | undefined>(undefined)
    const color = computed(() => value() ?? inner() ?? defaultValue() ?? DEFAULT)
    // A grey keeps the hue it was given.
    const memory = signal<ColorMemory>({})
    const step = () => {
      const s = this.step()
      return s !== undefined && s > 0 ? s : 1
    }
    // The last hue changed to: a commit follows it in the same interaction, before the props do.
    let latest: number | null = null
    const withHue = (hue: number) =>
      colorWithHue(untracked(color), hue, this.colorSpace(), untracked(memory))
    const drag = pointerAngleSession()
    const { view, send } = injectMachine(
      angleSliderMachine,
      () => ({
        value: hueOf(color(), step(), memory()),
        step: step(),
        wrap: true,
        largeStep: this.largeStep(),
        disabled: this.disabled(),
        readOnly: this.readonly(),
        onValueChange: (hue: number, d: ChangeDetails<AngleSliderEvent>) => {
          latest = hue
          const next = withHue(hue)
          memory.update((m) => ({ ...m, hue }))
          if (untracked(value) === undefined) inner.set(next)
          this.valueChange.emit(next)
          this.valueChangeDetails.emit({ value: next, details: d })
        },
        onValueCommit: (hue: number, d: { readonly reason: AngleSliderReason }) =>
          this.valueCommit.emit({ value: withHue(latest ?? hue), reason: d.reason }),
      }),
      {
        drag,
        focusInput: (m: Modality) => {
          if (this.inputEl) void focusSafely(this.inputEl, env, "programmatic", m)
        },
      },
    )
    this.send = send
    const modality = injectModality(env.modality, this.focused)
    const dragging = () => view().state === "dragging"
    this.api = computed(() =>
      colorWheelConnect({
        instance: instance(),
        color: color(),
        memory: memory(),
        step: step(),
        dragging: dragging(),
        disabled: this.disabled(),
        readOnly: this.readonly(),
        invalid: this.invalid(),
        focused: this.focused(),
        modality: modality(),
        locale: locale().locale,
        messages: messages(),
        ariaLabel,
        ariaLabelledBy,
        ids: {
          label: rendered() ?? this.labelId(),
          input: partId("color-wheel", instance(), "input"),
        },
        rendered: { label: rendered() !== undefined },
        name: this.name(),
        form: this.form(),
        defaultColor: defaultValue() ?? DEFAULT,
      }),
    )
    this.state = computed(() => ({
      color: color(),
      hue: this.api().hue,
      dragging: dragging(),
      disabled: this.disabled(),
      readOnly: this.readonly(),
    }))
    this.press = (track, e) => {
      if (!isDragPress(e) || drag.active || untracked(this.disabled)) return
      const thickness =
        Number.parseFloat(
          getComputedStyle(track).getPropertyValue("--rind-color-wheel-thickness"),
        ) || THICKNESS
      // Only the ring takes a press: the hole and the corners do nothing.
      if (!onRing(track, e, thickness)) return
      const onThumb = this.thumbEl?.contains(e.target as Node) === true
      const angle = drag.press(track, e, onThumb ? untracked(this.api).hue : undefined)
      // Focus goes to the input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      send({
        type: "POINTER.DOWN",
        angle,
        onThumb,
        modality: e.pointerType === "touch" ? "touch" : "pointer",
      })
    }
    // The name is the input's (connect puts aria-label/labelledby there too).
    bindProps(() => this.api().root(), {
      owns: [
        "colorspace",
        "defaultvalue",
        "disabled",
        "form",
        "id",
        "invalid",
        "largestep",
        "locale",
        "messages",
        "name",
        "readonly",
        "step",
        "value",
      ],
      drop: () => ["aria-label", "aria-labelledby"],
    })
    // The hex input that submits the colour (the range input has no name), inside the Root: a
    // directive cannot template it, so it is created here.
    const rootEl: Element = inject(ElementRef).nativeElement
    const renderer = inject(Renderer2)
    const hidden: HTMLInputElement = renderer.createElement("input")
    this.hiddenEl = hidden
    renderer.appendChild(rootEl, hidden)
    effect(() => {
      for (const [key, value] of Object.entries(this.api().hiddenInput())) {
        if (key === "value") hidden.value = String(value)
        else if (value === undefined || value === false) renderer.removeAttribute(hidden, key)
        else renderer.setAttribute(hidden, key, value === true ? "" : String(value))
      }
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    const formInput = hiddenFormInput({ input: () => this.hiddenEl }, env)
    afterNextRender(() => {
      // The modality tracker must see the pointerdown that comes before the input's focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      // A form reset restores the default colour (and ends a drag).
      destroy.onDestroy(
        formInput.track({
          onReset: () => {
            inner.set(untracked(defaultValue) ?? DEFAULT)
            // The whole colour back to the default (not only its hue), with no callback.
            memory.set({})
            send({ type: "DRAG.CANCEL" })
          },
          current: () => ({ value: String(untracked(this.api).hiddenInput()["value"]) }),
        }),
      )
    })
  }
}

/** Names the slider. */
@Directive({ selector: "[rindColorWheelLabel]", exportAs: "rindColorWheelLabel" })
export class ColorWheelLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectColorWheel("Label")
    const own = () => this.id() ?? root.labelId()
    injectRegisterPart(root.registry, "label", own)
    bindProps(() => ({ ...root.api().label(), id: own() }), { owns: ["id"] })
  }
}

/** The hue ring: a press on the ring sets the hue and drags. */
@Directive({ selector: "[rindColorWheelTrack]", exportAs: "rindColorWheelTrack" })
export class ColorWheelTrack {
  constructor() {
    const root = injectColorWheel("Track")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() =>
      joinHandlers(root.api().track(), {
        onPointerDown: (e: PointerEvent) => root.press(el, e),
      }),
    )
  }
}

/** The handle on the ring, rotated by the hue; shows the input's focus. */
@Directive({ selector: "[rindColorWheelThumb]", exportAs: "rindColorWheelThumb" })
export class ColorWheelThumb {
  constructor() {
    const root = injectColorWheel("Thumb")
    root.thumbEl = inject(ElementRef).nativeElement
    bindProps(() => root.api().thumb())
  }
}

/** The visually hidden native range input of the hue: `<input rindColorWheelInput>`. */
@Directive({ selector: "input[rindColorWheelInput]", exportAs: "rindColorWheelInput" })
export class ColorWheelInput {
  constructor() {
    const root = injectColorWheel("Input")
    const el: HTMLInputElement = inject(ElementRef).nativeElement
    root.inputEl = el
    const env = injectEnvironment()
    bindProps(() =>
      joinHandlers(root.api().input(), {
        onKeyDown: (e: KeyboardEvent) => {
          const event = angleSliderKeyEvent(describeKey(e, env), {
            dragging: untracked(root.state).dragging,
          })
          if (!event || e.defaultPrevented) return
          e.preventDefault()
          // Escape ends the drag only: a surrounding layer stays open.
          if (event.type === "DRAG.CANCEL") e.stopPropagation()
          root.send(event)
        },
        // The native range input's own change (assistive technology, a click on it).
        onChange: () => root.send({ type: "INPUT.CHANGE", value: Number(el.value) }),
        onFocusIn: () => root.focused.set(true),
        onFocusOut: () => root.focused.set(false),
      }),
    )
  }
}

/** The formatted hue (hidden from assistive technology); its content replaces it. */
@Component({
  selector: "[rindColorWheelValue]",
  exportAs: "rindColorWheelValue",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class ColorWheelValue {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectColorWheel("Value")
    this.text = computed(() => `${root.api().hue}°`)
    bindProps(() => root.api().valuePart())
  }
}

/** The Color Wheel's parts, for a standalone component's `imports`. */
export const ColorWheel = [
  ColorWheelRoot,
  ColorWheelLabel,
  ColorWheelTrack,
  ColorWheelThumb,
  ColorWheelInput,
  ColorWheelValue,
] as const
