// Slider parts: wiring only. The machine owns the value (always an array), connect every
// attribute. Here the consumer's shape (`number` or array) is converted at the boundary, the
// thumb inputs are reached for property sync, reset and native adoption, and the Control's
// press is measured once by pointer-drag.
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
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  blurEvent,
  type ChangeDetails,
  describeKey,
  focusEvent,
  focusSafely,
  fractionOf,
  hiddenFormInput,
  isDragPress,
  labelInteraction,
  type Modality,
  mergeFieldProps,
  normalizeValues,
  partId,
  pointerDragSession,
  resolveSlider,
  type SliderCommitDetails,
  type SliderEvent,
  type SliderMessages,
  type SliderOrientation,
  type SliderReason,
  sameNumbers,
  sliderConnect,
  sliderDragAxis,
  sliderKeyEvent,
  sliderMachine,
  sliderMessages,
  sliderRange,
  type ThumbAlignment,
  type ThumbCollision,
  textSelection,
  thumbValueTexts,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

/** A single value, or one value per thumb. */
export type SliderValue = number | readonly number[]

export interface SliderChangeDetails {
  readonly reason: SliderReason
  /** The thumb whose value changed (the first, when several did). */
  readonly index: number
  readonly event: ChangeDetails<SliderEvent>["event"]
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}

/** What `valueChangeDetails` and `valueCommit` emit. */
export interface SliderChangeEvent {
  readonly value: SliderValue
  readonly details: SliderChangeDetails
}
export interface SliderCommitEvent {
  readonly value: SliderValue
  readonly details: SliderCommitDetails
}

export interface SliderState {
  readonly values: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly orientation: SliderOrientation
}

type FormInput = ReturnType<typeof hiddenFormInput>

const SLIDER = new InjectionToken<SliderRoot>("rind-ui.slider")

function injectSlider(part: string): SliderRoot {
  const root = inject(SLIDER, { optional: true })
  if (!root) throw new Error(`rindSlider${part} must be inside rindSliderRoot`)
  return root
}

const toArray = (v: SliderValue | undefined): readonly number[] | undefined =>
  v === undefined ? undefined : typeof v === "number" ? [v] : v

/**
 * A slider with one native range input per thumb (APG Slider, Multi-Thumb Slider):
 * `<div rindSliderRoot [(value)]="volume">` with a Label, a Control holding the Track (and its
 * Indicator) and one `<div rindSliderThumb [index]="i">` per value.
 */
@Directive({
  selector: "[rindSliderRoot]",
  exportAs: "rindSliderRoot",
  providers: [{ provide: SLIDER, useExisting: forwardRef(() => SliderRoot) }],
})
export class SliderRoot {
  /** Controlled value (`[(value)]`): a number, or one number per thumb. */
  readonly value = input<SliderValue>()
  /** Read at creation (default `min`); a later change only changes what a form reset restores. */
  readonly defaultValue = input<SliderValue>()
  readonly min = input<number>()
  readonly max = input<number>()
  readonly step = input<number>()
  /** Shift + arrow and PageUp / PageDown (default one tenth of the range). */
  readonly largeStep = input<number>()
  readonly minStepsBetweenThumbs = input<number>()
  readonly thumbCollision = input<ThumbCollision>()
  /** `contain` keeps thumbs inside the track; set `--rind-slider-thumb-size` to the thumb size. Default: `center`. */
  readonly thumbAlignment = input<ThumbAlignment>("center")
  /** The axis. Default: `horizontal`. */
  readonly orientation = input<SliderOrientation>("horizontal")
  /** Ignores all input; thumbs leave the tab order. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Keeps focus and value, ignores changes. */
  readonly readonly = input(false, { transform: booleanAttribute })
  /** `data-required` only: a range input always has a value. */
  readonly required = input(false, { transform: booleanAttribute })
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute })
  /** The submitted field name of every thumb. */
  readonly name = input<string>()
  /** The id of the form the inputs belong to. */
  readonly form = input<string>()
  readonly formatOptions = input<Intl.NumberFormatOptions>()
  /** Locale for formatting. Default: the provider's. */
  readonly locale = input<string>()
  /** Reading direction; mirrors a horizontal Slider. Default: the provider's. */
  readonly dir = input<"ltr" | "rtl">()
  readonly messages = input<Partial<SliderMessages>>()
  readonly id = input<string>()
  /** Every change proposes a value; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<SliderChangeEvent>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<SliderValue>()
  /** Once at the end of each interaction that changed the value (release, key, adjustment). */
  readonly valueCommit = output<SliderCommitEvent>()

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly api: Signal<ReturnType<typeof sliderConnect>>
  /** @internal */
  readonly send: (e: SliderEvent) => void
  /** @internal */
  readonly registry = injectPartRegistry<"label" | "description">(() => ({
    scope: "slider",
    root: this.instance(),
  }))
  /** @internal The thumbs' range inputs and elements, by index (set by the thumbs). */
  readonly inputs: (() => HTMLInputElement | null)[] = []
  /** @internal */
  readonly thumbs: (Element | null)[] = []
  /** @internal */
  readonly control: { value: Element | null } = { value: null }
  /** @internal */
  readonly values: Signal<readonly number[]>
  /** @internal */
  readonly formInput: (index: number) => FormInput
  /** @internal */
  readonly setThumbDisabled: (index: number, disabled: boolean | undefined) => void
  /** @internal */
  readonly press: (e: PointerEvent) => void
  /** @internal */
  readonly inField: boolean
  /** @internal */
  readonly direction: Signal<"ltr" | "rtl">
  /** The slider's state, for the template (`#s="rindSliderRoot"`, `s.state()`). */
  readonly state: Signal<SliderState>

  constructor() {
    const env = injectEnvironment()
    const instance = this.instance
    const locale = injectLocale(
      () => this.locale(),
      () => this.dir(),
    )
    this.direction = computed(() => locale().dir)
    const messages = injectMessages("slider", sliderMessages, () => this.messages())
    const binding = injectFieldControl()
    this.inField = binding !== null
    const fieldsetContext = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    const ownLabel = injectRenderedId(this.registry, "label")
    const ownDescription = injectRenderedId(this.registry, "description")
    const scalar = () => !Array.isArray(this.value() ?? this.defaultValue())
    const rangeProps = () => ({
      min: this.min(),
      max: this.max(),
      step: this.step(),
      largeStep: this.largeStep(),
      minStepsBetweenThumbs: this.minStepsBetweenThumbs(),
    })
    const range = computed(() => sliderRange(rangeProps()))
    // Normalised once, on the first read (grid, order, gap: ZG#2488); later defaults change a
    // reset only. The inputs are set after this constructor.
    let creation: readonly number[] | undefined
    const creationDefault = () =>
      (creation ??= untracked(() =>
        normalizeValues(toArray(this.defaultValue()) ?? [range().min], range(), "defaultValue"),
      ))
    const inputs = this.inputs
    const thumbs = this.thumbs
    const el = (index: number) => inputs[index]?.() ?? null
    let latest: readonly number[] | undefined
    const thumbDisabled = signal<readonly boolean[]>([])
    this.setThumbDisabled = (index, off) => {
      const prev = untracked(thumbDisabled)
      if ((prev[index] === true) === (off === true)) return
      const next = [...prev]
      next[index] = off === true
      thumbDisabled.set(next)
    }
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "slider",
          labelable: false,
          disabled: this.disabled() || fieldsetContext() || fieldsetDom(),
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
          describedBy: ownDescription(),
        },
        binding?.() ?? null,
      ),
    )
    // One hidden-form-input per thumb input (sync, reset, adoption); created on first use.
    const formInputs = new Map<number, FormInput>()
    const formInput = (index: number) => {
      let cap = formInputs.get(index)
      if (!cap) {
        cap = hiddenFormInput({ input: () => el(index) }, env)
        formInputs.set(index, cap)
      }
      return cap
    }
    this.formInput = formInput
    const focusThumb = (index: number, modality: Modality) => {
      const input = el(index)
      if (input) void focusSafely(input, env, "programmatic", modality)
    }
    const drag = pointerDragSession()
    const texts = (vs: readonly number[]) =>
      thumbValueTexts({
        values: vs,
        locale: locale().locale,
        formatOptions: this.formatOptions(),
        messages: messages(),
      })
    const shape = (v: readonly number[]): SliderValue => (scalar() ? (v[0] ?? range().min) : v)
    let lastReason: SliderReason | null = null
    const machineProps = () => {
      const valueArray = toArray(this.value())
      if (valueArray) normalizeValues(valueArray, range(), "value") // development warning only
      return {
        value: valueArray,
        defaultValue: toArray(this.defaultValue()) ?? creationDefault(),
        ...rangeProps(),
        thumbCollision: this.thumbCollision(),
        disabled: field().disabled,
        readOnly: field().readOnly,
        thumbDisabled: thumbDisabled(),
        onValueChange: (next: readonly number[], details: ChangeDetails<SliderEvent>) => {
          lastReason = details.reason
          const before = latest ?? untracked(this.values)
          if (untracked(this.value) === undefined) {
            // Uncontrolled: the inputs already show the value when the consumer runs (a
            // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
            const t = untracked(() => texts(next))
            next.forEach((v, i) => {
              formInput(i).sync({ value: String(v) }, { dispatch: false })
              el(i)?.setAttribute("aria-valuenow", String(v))
              const text = t[i]
              if (text !== undefined) el(i)?.setAttribute("aria-valuetext", text)
            })
          }
          let cancelled = false
          const value = untracked(() => shape(next))
          this.valueChangeDetails.emit({
            value,
            details: {
              reason: details.reason,
              index: Math.max(
                0,
                next.findIndex((v, i) => v !== before[i]),
              ),
              event: details.event,
              cancel: () => {
                cancelled = true
                details.cancel()
              },
            },
          })
          if (!cancelled) this.valueChange.emit(value)
        },
        onValueCommit: (next: readonly number[], details: SliderCommitDetails) => {
          binding?.().report({ type: "commit" })
          this.valueCommit.emit({ value: untracked(() => shape(next)), details })
        },
      }
    }
    const { view, send } = injectMachine(sliderMachine, machineProps, {
      inputs: {
        sync: (values: readonly number[], dispatch: readonly boolean[]) =>
          values.forEach((v, i) => {
            formInput(i).sync({ value: String(v) }, { dispatch: dispatch[i] === true })
          }),
      },
      drag,
      focusThumb,
    })
    this.send = send
    const values = computed(() => resolveSlider(machineProps(), view().values.value).values)
    this.values = values
    const focused = () => view().context.focused
    const modality = injectModality(env.modality, () => focused() !== null)
    const dragging = () => view().matches("dragging")
    this.api = computed(() => {
      const i = instance()
      return sliderConnect({
        instance: i,
        values: values(),
        range: range(),
        orientation: this.orientation(),
        dir: locale().dir,
        alignment: this.thumbAlignment(),
        field: field(),
        fieldData: binding?.().data,
        thumbDisabled: thumbDisabled(),
        focused: focused(),
        modality: modality(),
        active: view().context.active,
        draggingThumb: view().context.dragging,
        dragging: dragging(),
        ids: {
          root: i,
          label: partId("slider", i, "label"),
          description: partId("slider", i, "description"),
          input: (n: number) => partId("slider", i, `input-${n}`),
        },
        labelledBy: binding?.().ids.label ?? ownLabel(),
        locale: locale().locale,
        formatOptions: this.formatOptions(),
        messages: messages(),
        form: this.form(),
        defaultValues: normalizeValues(toArray(this.defaultValue()) ?? creationDefault(), range()),
      })
    })
    this.state = computed(() => ({
      values: values(),
      dragging: dragging(),
      disabled: field().disabled,
      readOnly: field().readOnly,
      orientation: this.orientation(),
    }))
    // A touch drag (iOS): no text selection or callout while it lasts (BU#1295).
    let selection: (() => void) | null = null
    this.press = (e) => {
      const f = untracked(field)
      if (!isDragPress(e) || drag.active || f.disabled || f.readOnly) return
      const surface = e.currentTarget
      if (!(surface instanceof HTMLElement)) return
      const thumb = (e.target as Element | null)?.closest?.(
        '[data-scope="slider"][data-part="thumb"]',
      )
      // A disabled thumb is no target: the press is a track press there.
      const index =
        thumb &&
        thumb.getAttribute("data-instance") === untracked(instance) &&
        !thumb.hasAttribute("data-disabled")
          ? Number(thumb.getAttribute("data-index"))
          : null
      const vs = untracked(values)
      const r = untracked(range)
      const anchor = index === null ? undefined : fractionOf(vs[index] ?? r.min, r)
      const contain =
        untracked(this.thumbAlignment) === "contain" ? (thumbs[index ?? 0] ?? null) : null
      const fraction = drag.press(surface, e, {
        ...sliderDragAxis(
          { orientation: untracked(this.orientation), dir: untracked(locale).dir },
          contain instanceof HTMLElement ? contain : null,
        ),
        anchor,
      })
      // Focus goes to the thumb input (the machine moves it): the browser must not blur it.
      e.preventDefault()
      const touch = e.pointerType === "touch"
      if (touch) selection = textSelection(surface, env, true)
      send({ type: "POINTER.DOWN", fraction, thumb: index, modality: touch ? "touch" : "pointer" })
    }
    bindProps(() => this.api().root(), {
      owns: [
        "defaultvalue",
        "dir",
        "disabled",
        "form",
        "formatoptions",
        "id",
        "invalid",
        "largestep",
        "locale",
        "max",
        "messages",
        "min",
        "minstepsbetweenthumbs",
        "name",
        "orientation",
        "readonly",
        "required",
        "step",
        "thumbalignment",
        "thumbcollision",
        "value",
      ],
    })

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // After every render: each input shows the value (hydration, a parent's change); no events.
    afterEveryRender(() => {
      latest = untracked(values)
      for (const [i, v] of latest.entries())
        formInput(i).sync({ value: String(v) }, { dispatch: false })
    })
    let ready = false
    afterNextRender(() => {
      ready = true
      const node = this.control.value ?? el(0)
      if (node) {
        const w = watchFieldsetDisabled(node, (d) => fieldsetDom.set(d))
        fieldsetDom.set(w.disabled)
        destroy.onDestroy(w.stop)
      }
      // field-control: one control; the first thumb input is its validity element.
      if (binding) {
        const first = partId("slider", untracked(instance), "input-0")
        destroy.onDestroy(
          binding().register(
            {
              id: first,
              labelable: false,
              focus: (m) => focusThumb(0, m),
              validityElement: () => el(0),
              value: () => untracked(values),
            },
            first,
          ),
        )
      }
    })
    let reported: readonly number[] | undefined
    effect(() => {
      const now = values()
      if (!ready || reported === undefined) {
        reported = now
        return
      }
      if (sameNumbers(reported, now)) return
      reported = now
      untracked(() => {
        const user = lastReason !== null && lastReason !== "RESET"
        lastReason = null
        binding?.().report({ type: "change", value: now, user, composing: false })
      })
    })
    effect(() => {
      if (dragging()) return
      selection?.()
      selection = null
    })
  }
}

/** The visible name: `<label rindSliderLabel>`; a press focuses the first enabled thumb. */
@Directive({ selector: "[rindSliderLabel]", exportAs: "rindSliderLabel" })
export class SliderLabel {
  constructor() {
    const root = injectSlider("Label")
    const env = injectEnvironment()
    injectRegisterPart(root.registry, "label", () => partId("slider", root.instance(), "label"))
    const firstEnabled = () =>
      root.inputs.map((get) => get()).find((el) => el && !el.disabled) ?? null
    // Safari does not focus the input from a label: a press does, with no focus ring.
    const interaction = labelInteraction(env, {
      target: firstEnabled,
      forwardsFocus: () => true,
      focusTarget: () => {
        const el = firstEnabled()
        if (el) void focusSafely(el, env, "programmatic", "pointer")
      },
    })
    bindProps(() => joinHandlers(root.api().label(), interaction))
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => {
      if (root.inField) warnOwnLabelInField("slider")
    })
  }
}

/** The formatted value (a range for two thumbs): its content, or the text. Not a live region. */
@Component({
  selector: "[rindSliderValueText]",
  exportAs: "rindSliderValueText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class SliderValueText {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectSlider("ValueText")
    const part = computed(() => root.api().valueText())
    this.text = computed(() => part().text)
    bindProps(() => {
      const { text: _text, ...own } = part()
      return own
    })
  }
}

/** The pointer surface: a press moves the nearest thumb there and starts a drag. */
@Directive({ selector: "[rindSliderControl]", exportAs: "rindSliderControl" })
export class SliderControl {
  constructor() {
    const root = injectSlider("Control")
    const env = injectEnvironment()
    root.control.value = inject(ElementRef).nativeElement
    bindProps(() => joinHandlers(root.api().control(), { onPointerDown: root.press }))
    if (inject(PLATFORM_ID) !== "browser") return
    // The modality tracker must see the pointerdown that comes before the thumb's focus.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

@Directive({ selector: "[rindSliderTrack]", exportAs: "rindSliderTrack" })
export class SliderTrack {
  constructor() {
    const root = injectSlider("Track")
    bindProps(() => root.api().track())
  }
}

/** The filled range: from the start (one thumb) or between the outer thumbs. */
@Directive({ selector: "[rindSliderIndicator]", exportAs: "rindSliderIndicator" })
export class SliderIndicator {
  constructor() {
    const root = injectSlider("Indicator")
    bindProps(() => root.api().indicator())
  }
}

/** Decorative tick marks (`aria-hidden`). */
@Directive({ selector: "[rindSliderMarkerGroup]", exportAs: "rindSliderMarkerGroup" })
export class SliderMarkerGroup {
  constructor() {
    const root = injectSlider("MarkerGroup")
    bindProps(() => root.api().markerGroup())
  }
}

/**
 * One thumb and its native range input (the focusable `slider`), rendered after its content:
 * `<div rindSliderThumb [index]="0" aria-label="Minimum">`; the name goes to the input.
 */
@Component({
  selector: "[rindSliderThumb]",
  exportAs: "rindSliderThumb",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content /><input #input [rindProps]="inputProps()" />`,
})
export class SliderThumb {
  /** The thumb's value index (known on the server). */
  readonly index = input.required<number>()
  /** Disables this thumb only. */
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** Submitted under this name instead of the Root's. */
  readonly name = input<string>()

  /** @internal */
  protected readonly inputProps: Signal<ReturnType<ReturnType<typeof sliderConnect>["input"]>>
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>("input")

  constructor() {
    const root = injectSlider("Thumb")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    // The thumb's name is its input's (moved there; the thumb itself is decorative).
    const ariaLabel = inject(new HostAttributeToken("aria-label"), { optional: true }) ?? undefined
    const ariaLabelledBy =
      inject(new HostAttributeToken("aria-labelledby"), { optional: true }) ?? undefined
    const own = () => ({
      disabled: this.disabled(),
      ariaLabel,
      ariaLabelledBy,
      name: this.name(),
    })
    this.inputProps = computed(() => {
      const index = this.index()
      return joinHandlers(root.api().input(index, own()), {
        onKeyDown: (e: KeyboardEvent) => {
          const event = sliderKeyEvent(describeKey(e, env), index, {
            orientation: root.orientation(),
            dir: root.direction(),
            platform: env.platform,
            dragging: root.state().dragging,
          })
          if (!event || e.defaultPrevented) return
          // Neither the native input nor the page reacts (RX#1054, KB#293).
          e.preventDefault()
          // Escape ends the drag only: a surrounding layer stays open.
          if (event.type === "DRAG.CANCEL") e.stopPropagation()
          root.send(event)
        },
        onFocusIn: (e: FocusEvent) => {
          if (e.currentTarget instanceof Element)
            root.send({ ...focusEvent(e.currentTarget, env.modality), thumb: index })
        },
        onFocusOut: () => root.send({ ...blurEvent(env.modality), thumb: index }),
      })
    })
    bindProps(() => root.api().thumb(this.index(), own()), {
      owns: ["aria-label", "aria-labelledby", "disabled", "index", "name"],
    })
    // Registered by index; read after the first render (the view's input exists then).
    let at: number | undefined
    effect(() => {
      const index = this.index()
      untracked(() => {
        if (at !== undefined && at !== index) {
          root.thumbs[at] = null
          root.inputs[at] = () => null
        }
        at = index
        root.thumbs[index] = el
        root.inputs[index] = () => this.inputRef()?.nativeElement ?? null
      })
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    let ready = false
    let stopTrack: (() => void) | undefined
    let tracked: number | undefined
    const sync = () => {
      const index = this.index()
      const disabled = this.disabled()
      untracked(() => {
        root.setThumbDisabled(index, disabled)
        if (tracked === index) return
        if (tracked !== undefined) root.setThumbDisabled(tracked, false)
        tracked = index
        stopTrack?.()
        // Reset (once, on the first input), re-sync after it, and native adoption (AT adjusting).
        stopTrack = root.formInput(index).track({
          onReset: () => root.send({ type: "RESET" }),
          resetsWithForm: index === 0,
          current: () => ({ value: String(root.values()[index] ?? "") }),
          onNativeInput: (input) => {
            root.send({ type: "INPUT.CHANGE", thumb: index, value: Number(input.value) })
            return true
          },
        })
      })
    }
    afterNextRender(() => {
      ready = true
      sync()
    })
    effect(() => {
      this.index()
      this.disabled()
      if (ready) untracked(sync)
    })
    destroy.onDestroy(() => {
      stopTrack?.()
      if (tracked !== undefined) root.setThumbDisabled(tracked, false)
    })
  }
}

/** A tick at `value`: `data-state` under-value, at-value or over-value. */
@Directive({ selector: "[rindSliderMarker]", exportAs: "rindSliderMarker" })
export class SliderMarker {
  /** The value the tick marks. */
  readonly value = input.required<number>()
  constructor() {
    const root = injectSlider("Marker")
    bindProps(() => root.api().marker(this.value()), { owns: ["value"] })
  }
}

/** Help text, referenced by every thumb input's `aria-describedby`. */
@Directive({ selector: "[rindSliderDescription]", exportAs: "rindSliderDescription" })
export class SliderDescription {
  constructor() {
    const root = injectSlider("Description")
    injectRegisterPart(root.registry, "description", () =>
      partId("slider", root.instance(), "description"),
    )
    bindProps(() => root.api().description())
  }
}

/** The Slider's parts, for a standalone component's `imports`. */
export const Slider = [
  SliderRoot,
  SliderLabel,
  SliderValueText,
  SliderControl,
  SliderTrack,
  SliderIndicator,
  SliderMarkerGroup,
  SliderThumb,
  SliderMarker,
  SliderDescription,
] as const
