// Color Area parts: wiring only. The machine owns the colour, connect every attribute; here
// the two axis inputs are reached for property sync, reset and native adoption, and the
// Root's press is measured once by pointer-drag (2D). Internal: the Color Picker's Area is
// this component bound to the picker's colour.
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
  output,
  PLATFORM_ID,
  type Signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  blurEvent,
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorCommitDetails,
  type ColorNameProp,
  type ColorSpace,
  describeKey,
  focusEvent,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type MessageOverrides,
  type Modality,
  makeColor,
  type PartProps,
  partId,
  pointerDragSession2D,
  textSelection,
} from "@rind-ui/core"
import {
  areaAxes,
  areaValueOf,
  areaWorking,
  type ColorAreaEvent,
  type ColorAreaMessages,
  type ColorAreaReason,
  colorAreaConnect,
  colorAreaKeyEvent,
  colorAreaMachine,
  colorAreaMessages,
  thumbPoint,
} from "@rind-ui/core/internal"
import { bindProps, joinHandlers } from "../bind-props"
import { injectColorBinding } from "../color-binding"
import { colorReader } from "../color-input"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

type Axis = "x" | "y"
type FormInput = ReturnType<typeof hiddenFormInput>

export interface ColorAreaState {
  readonly color: Color
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

export interface ColorAreaChangeEvent {
  readonly value: Color
  readonly details: ColorChangeDetails<ColorAreaReason>
}

const AREA = new InjectionToken<ColorAreaRoot>("rind-ui.color-area")

function injectArea(part: string): ColorAreaRoot {
  const root = inject(AREA, { optional: true })
  if (!root) throw new Error(`rindColorArea${part} must be inside rindColorAreaRoot`)
  return root
}

const DEFAULT = makeColor("hsb", [0, 0, 100])

/**
 * A two-dimensional picker for two channels of a colour (two native range inputs):
 * `<div rindColorAreaRoot aria-label="Fill">` with a Background and a Thumb. Internal.
 */
@Directive({
  selector: "[rindColorAreaRoot], [rindColorPickerArea]",
  exportAs: "rindColorAreaRoot",
  providers: [{ provide: AREA, useExisting: forwardRef(() => ColorAreaRoot) }],
})
export class ColorAreaRoot {
  /** The colour (`[(value)]`). */
  readonly value = input<string | Color>()
  /** Default `hsb(0, 0%, 100%)`; a later change only changes what a form reset restores. */
  readonly defaultValue = input<string | Color>()
  /** The space of the axes (default: the first colour's space, else `hsb`). */
  readonly colorSpace = input<ColorSpace>()
  /** The horizontal channel. Default: saturation (hsb, hsl), red (rgb). */
  readonly xChannel = input<ColorChannel>()
  /** The vertical channel. Default: brightness (hsb), lightness (hsl), green (rgb). */
  readonly yChannel = input<ColorChannel>()
  /** Submits the x channel under this name. */
  readonly xName = input<string>()
  /** Submits the y channel under this name. */
  readonly yName = input<string>()
  /** The id of the form the inputs belong to. */
  readonly form = input<string>()
  /** Ignores presses and keys. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Focusable, changes nothing. */
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Replaces the colour name in the value text. */
  readonly colorName = input<ColorNameProp>()
  /** Formats the value text. Default: the provider's locale. */
  readonly locale = input<string>()
  /** Mirrors the x axis. Default: the provider's direction. */
  readonly dir = input<"ltr" | "rtl">()
  /** Names, role description, value text and colour words. */
  readonly messages = input<MessageOverrides<ColorAreaMessages>>()
  readonly id = input<string>()
  /** Each applied change, in the space of the colour you passed; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ColorAreaChangeEvent>()
  /** The accepted colour, for `[(value)]`. */
  readonly valueChange = output<Color>()
  /** Once at the end of each interaction that changed the colour. */
  readonly valueCommit = output<{
    value: Color
    details: ColorCommitDetails<ColorAreaReason>
  }>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof colorAreaConnect>>
  /** @internal */
  readonly send: (e: ColorAreaEvent) => void
  /** @internal */
  readonly inputs: Record<Axis, () => HTMLInputElement | null> = { x: () => null, y: () => null }
  /** @internal */
  readonly formInput: (axis: Axis) => FormInput
  /** @internal The values each input shows. */
  readonly shown: () => { x: number; y: number }
  /** @internal */
  readonly thumb: { value: Element | null } = { value: null }
  /** @internal */
  readonly direction: () => "ltr" | "rtl"
  /** The area's state, for the template (`#a="rindColorAreaRoot"`, `a.state()`). */
  readonly state: Signal<ColorAreaState>

  constructor() {
    const env = injectEnvironment()
    const binding = injectColorBinding()
    const instance = injectRootId(() => this.id())
    const loc = injectLocale(
      () => this.locale() ?? binding?.locale(),
      () => this.dir() ?? binding?.dir(),
    )
    this.direction = () => loc().dir
    const messages = injectMessages("color-area", colorAreaMessages, () => {
      if (!binding) return this.messages()
      const m = binding.messages()
      return { ...m, valueText: m.areaValueText, ...this.messages() }
    })
    const value = colorReader(() => this.value(), "value", "color-area")
    const defaultValue = colorReader(() => this.defaultValue(), "defaultValue", "color-area")
    const own = () => (binding ? binding.color() : value())
    const disabled = () => binding?.disabled() ?? this.disabled()
    const readOnly = () => binding?.readOnly() ?? this.readonly()
    const colorName = () => this.colorName() ?? binding?.colorName()
    // The space of the axes: the input, else the first colour's (read once), else hsb.
    let firstSpace: ColorSpace | undefined
    const space = (): ColorSpace => {
      const given = this.colorSpace()
      if (given) return given
      if (binding) return "hsb"
      firstSpace ??= untracked(() => (own() ?? defaultValue())?.space ?? "hsb")
      return firstSpace
    }
    const axes = computed(() => areaAxes(space(), this.xChannel(), this.yChannel()))
    const inputs = this.inputs
    const formInputs = new Map<Axis, FormInput>()
    this.formInput = (axis) => {
      let cap = formInputs.get(axis)
      if (!cap) {
        cap = hiddenFormInput({ input: () => inputs[axis]() }, env)
        formInputs.set(axis, cap)
      }
      return cap
    }
    const formInput = this.formInput
    const drag = pointerDragSession2D()
    const machineProps = () => ({
      value: own(),
      defaultValue: defaultValue(),
      axes: axes(),
      fallback: DEFAULT,
      disabled: disabled(),
      readOnly: readOnly(),
      onValueChange: (c: Color, d: { reason: string; cancel(): void }) => {
        // A form reset reports nothing (spec "Form Participation").
        if (d.reason === "RESET") return
        const reason = d.reason as ColorAreaReason
        if (binding) {
          binding.set(c, "AREA")
          return
        }
        let cancelled = false
        this.valueChangeDetails.emit({
          value: c,
          details: {
            reason,
            space: untracked(axes).space,
            cancel: () => {
              cancelled = true
              d.cancel()
            },
          },
        })
        if (!cancelled) this.valueChange.emit(c)
      },
      onValueCommit: (c: Color, d: ColorCommitDetails<ColorAreaReason>) => {
        if (binding) binding.commit("AREA")
        else this.valueCommit.emit({ value: c, details: d })
      },
    })
    const { view, send } = injectMachine(colorAreaMachine, machineProps, {
      inputs: {
        sync: (x: number, y: number, dispatch: readonly [boolean, boolean]) => {
          formInput("x").sync({ value: String(x) }, { dispatch: dispatch[0] })
          formInput("y").sync({ value: String(y) }, { dispatch: dispatch[1] })
        },
      },
      drag,
      focusAxis: (axis: Axis, modality: Modality) => {
        const el = inputs[axis]()
        if (el) void focusSafely(el, env, "programmatic", modality)
      },
    })
    this.send = send
    const color = () => areaWorking(machineProps(), view().context, view().values.value)
    const modality = injectModality(env.modality, () => view().context.focused !== null)
    const dragging = () => view().matches("dragging")
    const ariaLabel = inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
    const ariaLabelledBy =
      inject(new HostAttributeToken("aria-labelledby"), { optional: true }) ?? undefined
    const ariaDescribedBy =
      inject(new HostAttributeToken("aria-describedby"), { optional: true }) ?? undefined
    this.api = computed(() =>
      colorAreaConnect({
        instance: instance(),
        color: color(),
        memory: view().context.memory,
        axes: axes(),
        dir: loc().dir,
        disabled: disabled(),
        readOnly: readOnly(),
        dragging: dragging(),
        focused: view().context.focused,
        tabStop: view().context.tabStop,
        changed: view().context.changed,
        modality: modality(),
        messages: messages(),
        locale: loc().locale,
        colorName: colorName(),
        ariaLabel,
        ariaLabelledBy,
        ariaDescribedBy,
        ids: {
          root: instance(),
          input: (axis) => partId("color-area", instance(), `input-${axis}`),
        },
        names: { x: this.xName(), y: this.yName() },
        form: this.form(),
        defaultColor: areaValueOf({ ...machineProps(), value: undefined }, undefined),
      }),
    )
    this.shown = () => ({
      x: Number(this.api().input("x")["aria-valuenow"]),
      y: Number(this.api().input("y")["aria-valuenow"]),
    })
    this.state = computed(() => ({
      color: color(),
      dragging: dragging(),
      disabled: disabled(),
      readOnly: readOnly(),
    }))
    const thumb = this.thumb
    // A touch drag (iOS): no text selection or callout while it lasts.
    let selection: (() => void) | null = null
    const press = (e: PointerEvent) => {
      if (!isDragPress(e) || drag.active || untracked(disabled)) return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const surface = e.currentTarget
      if (!(surface instanceof HTMLElement)) return
      const onThumb = thumb.value?.contains(e.target as Node) === true
      const p = thumbPoint(untracked(color), untracked(axes), untracked(view).context.memory)
      const anchor = onThumb ? { x: Number(p.x), y: Number(p.y) } : undefined
      const point = drag.press(surface, e, { dir: untracked(loc).dir, anchor })
      // Focus goes to the x input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      const touch = e.pointerType === "touch"
      if (touch && !untracked(readOnly)) selection = textSelection(surface, env, true)
      send({ type: "POINTER.DOWN", point, onThumb, modality: touch ? "touch" : "pointer" })
    }
    bindProps(() => joinHandlers(this.api().root(), { onPointerDown: press }), {
      owns: [
        "aria-describedby",
        "aria-label",
        "aria-labelledby",
        "colorname",
        "colorspace",
        "defaultvalue",
        "dir",
        "disabled",
        "form",
        "id",
        "locale",
        "messages",
        "readonly",
        "value",
        "xchannel",
        "xname",
        "ychannel",
        "yname",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // After every render: each input shows the value (hydration, a parent's change); no events.
    afterEveryRender(() => {
      const s = untracked(this.shown)
      formInput("x").sync({ value: String(s.x) }, { dispatch: false })
      formInput("y").sync({ value: String(s.y) }, { dispatch: false })
    })
    // The modality tracker must see the pointerdown that comes before the input's focus.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    effect(() => {
      if (dragging()) return
      selection?.()
      selection = null
    })
  }
}

/** The gradient: decorative. */
@Directive({
  selector: "[rindColorAreaBackground], [rindColorPickerAreaBackground]",
  exportAs: "rindColorAreaBackground",
})
export class ColorAreaBackground {
  constructor() {
    const root = injectArea("Background")
    bindProps(() => root.api().background())
  }
}

/** The handle: positioned from the value; renders the x and y inputs (the focusable `slider`s). */
@Component({
  selector: "[rindColorAreaThumb], [rindColorPickerAreaThumb]",
  exportAs: "rindColorAreaThumb",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content /><input #x [rindProps]="axisProps('x')" /><input #y [rindProps]="axisProps('y')" />`,
})
export class ColorAreaThumb {
  /** @internal */
  protected readonly axisProps: (axis: Axis) => PartProps
  private readonly x = viewChild<ElementRef<HTMLInputElement>>("x")
  private readonly y = viewChild<ElementRef<HTMLInputElement>>("y")

  constructor() {
    const root = injectArea("Thumb")
    const env = injectEnvironment()
    root.thumb.value = inject(ElementRef).nativeElement
    root.inputs.x = () => this.x()?.nativeElement ?? null
    root.inputs.y = () => this.y()?.nativeElement ?? null
    const props = (axis: Axis) =>
      computed(() =>
        joinHandlers(root.api().input(axis), {
          onKeyDown: (e: KeyboardEvent) => {
            const event = colorAreaKeyEvent(describeKey(e, env), {
              dir: root.direction(),
              dragging: root.state().dragging,
            })
            if (!event || e.defaultPrevented) return
            e.preventDefault()
            // Escape ends the drag only: a surrounding layer stays open.
            if (event.type === "DRAG.CANCEL") e.stopPropagation()
            root.send(event)
          },
          onFocusIn: (e: FocusEvent) => {
            if (e.currentTarget instanceof Element)
              root.send({ ...focusEvent(e.currentTarget, env.modality), axis })
          },
          onFocusOut: () => root.send({ ...blurEvent(env.modality), axis }),
        }),
      )
    const both = { x: props("x"), y: props("y") }
    this.axisProps = (axis) => both[axis]()
    bindProps(() => root.api().thumb())
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      for (const axis of ["x", "y"] as const) {
        destroy.onDestroy(
          root.formInput(axis).track({
            onReset: () => root.send({ type: "RESET" }),
            resetsWithForm: axis === "x",
            current: () => ({ value: String(root.shown()[axis]) }),
            onNativeInput: (el) => {
              root.send({ type: "INPUT.CHANGE", axis, value: Number(el.value) })
              return true
            },
          }),
        )
      }
    })
  }
}

/** The Color Area's parts. Internal. */
export const ColorArea = [ColorAreaRoot, ColorAreaBackground, ColorAreaThumb] as const
