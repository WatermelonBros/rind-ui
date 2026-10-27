// Angle Slider (add-angle-slider): a dial whose value is an angle. A visually hidden native range
// input is the only focusable and announced element; a press on the Control sets the angle
// from the pointer (a press on the Thumb keeps its offset) and drags on.
import {
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
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  type AngleSliderEvent,
  type AngleSliderMessages,
  type AngleSliderReason,
  angleSliderConnect,
  angleSliderKeyEvent,
  angleSliderMachine,
  angleSliderMessages,
  angleValueOf,
  type ChangeDetails,
  describeKey,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type MessageOverrides,
  type Modality,
  type PartProps,
  partId,
  pointerAngleSession,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"

/** The dial's state, for the template (`#a="rindAngleSliderRoot"`, `a.state()`). */
export interface AngleSliderRenderState {
  /** The angle in degrees, [0, 360). */
  readonly value: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

const ANGLE_SLIDER = new InjectionToken<AngleSliderRoot>("rind-ui.angle-slider")

function injectAngleSlider(part: string): AngleSliderRoot {
  const root = inject(ANGLE_SLIDER, { optional: true })
  if (!root) throw new Error(`rindAngleSlider${part} must be inside rindAngleSliderRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))

/**
 * A dial: `<div rindAngleSliderRoot [(value)]="heading">` with a Label, a Control holding the
 * Thumb and Markers, the Input (a visually hidden range input) and a Value.
 */
@Directive({
  selector: "[rindAngleSliderRoot]",
  exportAs: "rindAngleSliderRoot",
  providers: [{ provide: ANGLE_SLIDER, useExisting: forwardRef(() => AngleSliderRoot) }],
})
export class AngleSliderRoot {
  /** Controlled angle in degrees, [0, 360) (`[(value)]`). */
  readonly value = input(undefined, { transform: optionalNumber })
  /** Uncontrolled angle. Default 0. */
  readonly defaultValue = input(undefined, { transform: optionalNumber })
  /** Degrees per step. Default 1. */
  readonly step = input(undefined, { transform: optionalNumber })
  /** Shift+Arrow, PageUp and PageDown. Default 15. */
  readonly largeStep = input(undefined, { transform: optionalNumber })
  /** A step past an end wraps around. Default true. */
  readonly wrap = input(true, { transform: booleanAttribute })
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  readonly invalid = input(false, { transform: booleanAttribute })
  /** The form field's name. */
  readonly name = input<string>()
  /** The form's id, when outside it. */
  readonly form = input<string>()
  readonly messages = input<MessageOverrides<AngleSliderMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  readonly valueChange = output<number>()
  readonly valueChangeDetails = output<{
    value: number
    details: ChangeDetails<AngleSliderEvent>
  }>()
  /** Once per interaction: a drag's release, a key, a native change. */
  readonly valueCommit = output<{ value: number; reason: AngleSliderReason }>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof angleSliderConnect>>
  /** @internal */
  readonly send: (event: AngleSliderEvent) => void
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"label">>
  /** @internal */
  readonly labelId: () => string
  /** @internal */
  readonly focused = signal(false)
  /** @internal */
  readonly press: (control: Element, e: PointerEvent) => void
  /** @internal */
  inputEl: HTMLInputElement | null = null
  /** @internal */
  thumbEl: Element | null = null
  readonly state: Signal<AngleSliderRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment()
    const messages = injectMessages("angle-slider", angleSliderMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    this.registry = injectPartRegistry<"label">(() => ({
      scope: "angle-slider",
      root: instance(),
    }))
    const rendered = injectRenderedId(this.registry, "label")
    this.labelId = () => partId("angle-slider", instance(), "label")
    const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
    const ariaLabel = read("aria-label") ?? undefined
    const ariaLabelledBy = read("aria-labelledby") ?? undefined
    const drag = pointerAngleSession()
    const machineProps = () => ({
      ...(this.value() === undefined ? {} : { value: this.value() }),
      defaultValue: this.defaultValue(),
      onValueChange: (v: number, d: ChangeDetails<AngleSliderEvent>) => {
        this.valueChange.emit(v)
        this.valueChangeDetails.emit({ value: v, details: d })
      },
      onValueCommit: (v: number, d: { readonly reason: AngleSliderReason }) =>
        this.valueCommit.emit({ value: v, reason: d.reason }),
      step: this.step(),
      largeStep: this.largeStep(),
      wrap: this.wrap(),
      disabled: this.disabled(),
      readOnly: this.readonly(),
    })
    const { view, send } = injectMachine(angleSliderMachine, machineProps, {
      drag,
      focusInput: (m: Modality) => {
        if (this.inputEl) void focusSafely(this.inputEl, env, "programmatic", m)
      },
    })
    this.send = send
    const modality = injectModality(env.modality, this.focused)
    const value = () => angleValueOf(machineProps(), view().values.value)
    const dragging = () => view().state === "dragging"
    this.api = computed(() => {
      const step = this.step()
      return angleSliderConnect({
        instance: instance(),
        value: value(),
        defaultValue: angleValueOf({ ...machineProps(), value: undefined }, undefined),
        step: step !== undefined && step > 0 ? step : 1,
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
          input: partId("angle-slider", instance(), "input"),
        },
        rendered: { label: rendered() !== undefined },
        name: this.name(),
        form: this.form(),
      })
    })
    this.state = computed(() => ({
      value: value(),
      dragging: dragging(),
      disabled: this.disabled(),
      readOnly: this.readonly(),
    }))
    this.press = (control, e) => {
      if (!isDragPress(e) || drag.active || untracked(this.disabled)) return
      const onThumb = this.thumbEl?.contains(e.target as Node) === true
      const angle = drag.press(control, e, onThumb ? untracked(value) : undefined)
      // The press would focus the Control's descendants: the input takes the focus instead.
      e.preventDefault()
      send({
        type: "POINTER.DOWN",
        angle,
        onThumb,
        modality: e.pointerType === "touch" ? "touch" : "pointer",
      })
    }
    // The name is the input's (connect puts aria-label/labelledby there).
    bindProps(() => this.api().root(), {
      owns: [
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
        "wrap",
      ],
      drop: () => ["aria-label", "aria-labelledby"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    const formInput = hiddenFormInput({ input: () => this.inputEl }, env)
    afterNextRender(() => {
      // The modality tracker must see the pointerdown that comes before the input's focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      // A form reset restores the default; the browser's own reset is re-synced after it.
      destroy.onDestroy(
        formInput.track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: String(untracked(value)) }),
          // The native range input's own change (assistive technology, a click on it).
          onNativeInput: (el) => {
            send({ type: "INPUT.CHANGE", value: Number(el.value) })
            return true
          },
        }),
      )
    })
  }
}

/** Names the input. */
@Directive({ selector: "[rindAngleSliderLabel]", exportAs: "rindAngleSliderLabel" })
export class AngleSliderLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectAngleSlider("Label")
    const own = () => this.id() ?? root.labelId()
    injectRegisterPart(root.registry, "label", own)
    bindProps(() => ({ ...root.api().label(), id: own() }), { owns: ["id"] })
  }
}

/** The dial: a press sets the angle from the pointer and drags on. */
@Directive({ selector: "[rindAngleSliderControl]", exportAs: "rindAngleSliderControl" })
export class AngleSliderControl {
  constructor() {
    const root = injectAngleSlider("Control")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() =>
      joinHandlers(root.api().control(), {
        onPointerDown: (e: PointerEvent) => root.press(el, e),
      }),
    )
  }
}

/** The handle, rotated by the angle; shows the input's focus. */
@Directive({ selector: "[rindAngleSliderThumb]", exportAs: "rindAngleSliderThumb" })
export class AngleSliderThumb {
  constructor() {
    const root = injectAngleSlider("Thumb")
    root.thumbEl = inject(ElementRef).nativeElement
    bindProps(() => root.api().thumb())
  }
}

/** The visually hidden native range input: `<input rindAngleSliderInput>`. */
@Directive({ selector: "input[rindAngleSliderInput]", exportAs: "rindAngleSliderInput" })
export class AngleSliderInput {
  constructor() {
    const root = injectAngleSlider("Input")
    const el: HTMLInputElement = inject(ElementRef).nativeElement
    root.inputEl = el
    const env = injectEnvironment()
    bindProps(() =>
      // `defaultValue` is the attribute a form reset restores; `value` is the property.
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
        onFocusIn: () => root.focused.set(true),
        onFocusOut: () => root.focused.set(false),
      }),
    )
  }
}

/** The formatted angle and a degree sign (hidden from assistive technology). */
@Component({
  selector: "[rindAngleSliderValue]",
  exportAs: "rindAngleSliderValue",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class AngleSliderValue {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectAngleSlider("Value")
    this.text = computed(() => `${root.api().formatted}°`)
    bindProps(() => root.api().valuePart())
  }
}

/** Holds the Markers (`aria-hidden`). */
@Directive({ selector: "[rindAngleSliderMarkerGroup]", exportAs: "rindAngleSliderMarkerGroup" })
export class AngleSliderMarkerGroup {
  constructor() {
    const root = injectAngleSlider("MarkerGroup")
    bindProps(() => root.api().markerGroup())
  }
}

/** A tick at `value`: under, at or over the current angle (`data-state`). */
@Directive({ selector: "[rindAngleSliderMarker]", exportAs: "rindAngleSliderMarker" })
export class AngleSliderMarker {
  readonly value = input.required({ transform: numberAttribute })
  constructor() {
    const root = injectAngleSlider("Marker")
    bindProps(() => root.api().marker(this.value()) as PartProps, { owns: ["value"] })
  }
}

/** The Angle Slider's parts, for a standalone component's `imports`. */
export const AngleSlider = [
  AngleSliderRoot,
  AngleSliderLabel,
  AngleSliderControl,
  AngleSliderThumb,
  AngleSliderInput,
  AngleSliderValue,
  AngleSliderMarkerGroup,
  AngleSliderMarker,
] as const
