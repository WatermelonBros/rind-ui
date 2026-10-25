// Rating parts: wiring only. The machine owns the value, connect every attribute. Here the
// range input and the form carrier are reached for property sync, reset and native adoption,
// and a star's pointer position is measured into the fraction the machine reads.
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
  hiddenFormInput,
  labelInteraction,
  type Modality,
  mergeFieldProps,
  normalizeRating,
  partId,
  type RatingEvent,
  type RatingMessages,
  ratingConnect,
  ratingFormValue,
  ratingFraction,
  ratingKeyEvent,
  ratingMachine,
  ratingMessages,
  ratingRange,
  resolveRating,
  warnOwnLabelInField,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

export interface RatingState {
  readonly value: number
  /** The hover preview, or null. */
  readonly preview: number | null
  readonly count: number
  readonly disabled: boolean
  readonly readOnly: boolean
}

const RATING = new InjectionToken<RatingRoot>("rind-ui.rating")

function injectRating(part: string): RatingRoot {
  const root = inject(RATING, { optional: true })
  if (!root) throw new Error(`rindRating${part} must be inside rindRatingRoot`)
  return root
}

/** The Control's elements, set by the Control (read after the first render). */
interface Elements {
  input: () => Element | null
  carrier: () => Element | null
  control: () => Element | null
}

const asInput = (el: Element | null) => (el instanceof HTMLInputElement ? el : null)

/**
 * A star rating: `<div rindRatingRoot [(value)]="score">` with a Label and a
 * `<div rindRatingControl>` of `<span rindRatingItem [index]="i">` stars; one native range input
 * (role slider) over the decorative stars.
 */
@Directive({
  selector: "[rindRatingRoot]",
  exportAs: "rindRatingRoot",
  providers: [{ provide: RATING, useExisting: forwardRef(() => RatingRoot) }],
})
export class RatingRoot {
  /** Controlled value (`[(value)]`): 0 (no rating) to `count`, in steps of 1 (0.5 with `allowHalf`). */
  readonly value = input<number>()
  /** Read at creation (default 0, no rating); a later change only changes what a form reset restores. */
  readonly defaultValue = input<number>()
  /** The number of stars. Default: 5. */
  readonly count = input<number>()
  /** Half stars: the left half of a star (the right one in RTL) and the keys move by 0.5. */
  readonly allowHalf = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** Pressing the current value, or the keys below the first star, go back to 0 (no rating). */
  readonly allowClear = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** Ignores all input; the Rating leaves the tab order. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Keeps focus and value, ignores changes. */
  readonly readonly = input(false, { transform: booleanAttribute })
  /** The form is invalid while there is no rating (the browser's own message). */
  readonly required = input(false, { transform: booleanAttribute })
  /** Sets `aria-invalid` and `data-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute })
  /** The submitted field name ("" while unrated). */
  readonly name = input<string>()
  /** The id of the form the inputs belong to. */
  readonly form = input<string>()
  /** Locale for the value text. Default: the provider's. */
  readonly locale = input<string>()
  /** Reading direction; mirrors the stars and the arrow keys. Default: the provider's. */
  readonly dir = input<"ltr" | "rtl">()
  readonly messages = input<Partial<RatingMessages>>()
  readonly id = input<string>()
  /** Every change proposes a value; `details.cancel()` vetoes it. */
  readonly valueChangeDetails = output<ChangeEvent<number, RatingEvent>>()
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<number>()

  private readonly emit = changeEmitter<number, RatingEvent>(
    this.valueChangeDetails,
    this.valueChange,
  )
  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly api: Signal<ReturnType<typeof ratingConnect>>
  /** @internal */
  readonly send: (e: RatingEvent) => void
  /** @internal */
  readonly registry = injectPartRegistry<"label">(() => ({
    scope: "rating",
    root: this.instance(),
  }))
  /** @internal */
  readonly els: Elements = { input: () => null, carrier: () => null, control: () => null }
  /** @internal */
  readonly inField: boolean
  /** @internal */
  readonly direction: Signal<"ltr" | "rtl">
  /** The rating's state, for the template (`#r="rindRatingRoot"`, `r.state()`). */
  readonly state: Signal<RatingState>

  constructor() {
    const env = injectEnvironment()
    const instance = this.instance
    const locale = injectLocale(
      () => this.locale(),
      () => this.dir(),
    )
    this.direction = computed(() => locale().dir)
    const messages = injectMessages("rating", ratingMessages, () => this.messages())
    const binding = injectFieldControl()
    this.inField = binding !== null
    const fieldsetContext = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    const ownLabel = injectRenderedId(this.registry, "label")
    const rangeProps = () => ({
      count: this.count(),
      allowHalf: this.allowHalf(),
      allowClear: this.allowClear(),
    })
    const range = computed(() => ratingRange(rangeProps()))
    // Normalised once, on the first read (the inputs are set after this constructor).
    let creation: number | undefined
    const creationDefault = () =>
      (creation ??= normalizeRating(untracked(this.defaultValue), untracked(range)))
    const els = this.els
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
        },
        binding?.() ?? null,
      ),
    )
    const rangeInput = hiddenFormInput({ input: () => asInput(els.input()) }, env)
    const carrierInput = hiddenFormInput(
      { input: () => asInput(els.carrier()), control: () => asInput(els.input()) },
      env,
    )
    const sync = (v: number, dispatch: boolean) => {
      rangeInput.sync({ value: String(v) }, { dispatch: false })
      carrierInput.sync({ value: ratingFormValue(v) }, { dispatch })
    }
    const focusInput = (modality: Modality) => {
      const el = asInput(els.input())
      if (el) void focusSafely(el, env, "programmatic", modality)
    }
    let lastReason: string | null = null
    const machineProps = () => ({
      value: this.value(),
      defaultValue: this.defaultValue() ?? creationDefault(),
      ...rangeProps(),
      disabled: field().disabled,
      readOnly: field().readOnly,
      onValueChange: (next: number, details: ChangeDetails<RatingEvent>) => {
        lastReason = details.reason
        // Uncontrolled: the inputs already show the value when the consumer runs (a
        // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
        if (this.value() === undefined) sync(next, false)
        this.emit(next, details)
      },
    })
    const { view, send } = injectMachine(ratingMachine, machineProps, {
      inputs: { sync },
      focusInput,
    })
    this.send = send
    const current = () => resolveRating(machineProps(), view().values.value).value
    const focused = () => view().context.focused
    const modality = injectModality(env.modality, focused)
    this.api = computed(() => {
      const i = instance()
      return ratingConnect({
        instance: i,
        dir: locale().dir,
        value: current(),
        preview: view().context.preview,
        range: range(),
        field: field(),
        fieldData: binding?.().data,
        focused: focused(),
        modality: modality(),
        ids: {
          root: i,
          label: partId("rating", i, "label"),
          input: partId("rating", i, "input"),
          hiddenInput: partId("rating", i, "hidden-input"),
        },
        labelledBy: binding?.().ids.label ?? ownLabel(),
        locale: locale().locale,
        messages: messages(),
        form: this.form(),
        defaultValue: normalizeRating(this.defaultValue() ?? creationDefault(), range()),
      })
    })
    this.state = computed(() => ({
      value: current(),
      preview: view().context.preview,
      count: range().count,
      disabled: field().disabled,
      readOnly: field().readOnly,
    }))
    bindProps(() => this.api().root(), {
      owns: [
        "allowclear",
        "allowhalf",
        "count",
        "defaultvalue",
        "dir",
        "disabled",
        "form",
        "id",
        "invalid",
        "locale",
        "messages",
        "name",
        "readonly",
        "required",
        "value",
      ],
    })

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // After every render: the inputs show the value (hydration, a parent's change); no events.
    afterEveryRender(() => {
      const latest = current()
      rangeInput.sync({ value: String(latest) }, { dispatch: false })
      carrierInput.sync({ value: ratingFormValue(latest) }, { dispatch: false })
    })
    let ready = false
    afterNextRender(() => {
      ready = true
      const node = els.control() ?? els.input()
      if (node) {
        const w = watchFieldsetDisabled(node, (d) => fieldsetDom.set(d))
        fieldsetDom.set(w.disabled)
        destroy.onDestroy(w.stop)
      }
      // Reset (through the carrier) and native adoption (assistive technology on the range input).
      destroy.onDestroy(
        carrierInput.track({
          onReset: () => send({ type: "RESET" }),
          current: () => ({ value: ratingFormValue(current()) }),
        }),
      )
      destroy.onDestroy(
        rangeInput.track({
          onReset: () => {},
          resetsWithForm: false,
          current: () => ({ value: String(current()) }),
          onNativeInput: (el) => {
            send({ type: "INPUT.CHANGE", value: Number(el.value) })
            return true
          },
        }),
      )
      // field-control: one control; the carrier is its validity element, the range input its focus.
      if (binding) {
        const id = partId("rating", instance(), "input")
        destroy.onDestroy(
          binding().register(
            {
              id,
              labelable: false,
              focus: focusInput,
              validityElement: () => asInput(els.carrier()),
              value: current,
            },
            id,
          ),
        )
      }
    })
    let reported: number | undefined
    effect(() => {
      const now = current()
      if (!ready || reported === undefined) {
        reported = now
        return
      }
      if (reported === now) return
      reported = now
      untracked(() => {
        const user = lastReason !== null && lastReason !== "RESET"
        lastReason = null
        binding?.().report({ type: "change", value: now, user, composing: false })
        if (user) binding?.().report({ type: "commit" })
      })
    })
  }
}

/** The visible name: `<label rindRatingLabel>`; a press focuses the range input. */
@Directive({ selector: "[rindRatingLabel]", exportAs: "rindRatingLabel" })
export class RatingLabel {
  constructor() {
    const root = injectRating("Label")
    const env = injectEnvironment()
    injectRegisterPart(root.registry, "label", () => partId("rating", root.instance(), "label"))
    const target = () => {
      const el = root.els.input()
      return el instanceof HTMLInputElement && !el.disabled ? el : null
    }
    // Safari does not focus the input from a label: a press does, with no focus ring.
    const interaction = labelInteraction(env, {
      target,
      forwardsFocus: () => true,
      focusTarget: () => {
        const el = target()
        if (el) void focusSafely(el, env, "programmatic", "pointer")
      },
    })
    bindProps(() => joinHandlers(root.api().label(), interaction))
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => {
      if (root.inField) warnOwnLabelInField("rating")
    })
  }
}

/**
 * The stars' row and the pointer surface: `<div rindRatingControl>`; renders the range input
 * and the form carrier after its content. Leaving it ends the hover preview.
 */
@Component({
  selector: "[rindRatingControl]",
  exportAs: "rindRatingControl",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content /><input #input [rindProps]="inputProps()" /><input
      #carrier
      [rindProps]="carrierProps()"
    />`,
})
export class RatingControl {
  /** @internal */
  readonly inputProps: Signal<ReturnType<ReturnType<typeof ratingConnect>["input"]>>
  /** @internal */
  readonly carrierProps: Signal<ReturnType<ReturnType<typeof ratingConnect>["hiddenInput"]>>
  private readonly inputRef = viewChild<ElementRef<Element>>("input")
  private readonly carrierRef = viewChild<ElementRef<Element>>("carrier")

  constructor() {
    const root = injectRating("Control")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    root.els.input = () => this.inputRef()?.nativeElement ?? null
    root.els.carrier = () => this.carrierRef()?.nativeElement ?? null
    root.els.control = () => el
    this.inputProps = computed(() =>
      joinHandlers(root.api().input(), {
        onKeyDown: (e: KeyboardEvent) => {
          const event = ratingKeyEvent(describeKey(e, env), {
            dir: root.direction(),
            platform: env.platform,
          })
          if (!event || e.defaultPrevented) return
          // Neither the native input nor the page reacts (RX#1054, KB#293).
          e.preventDefault()
          root.send(event)
        },
        onFocusIn: (e: FocusEvent) => {
          if (e.currentTarget instanceof Element)
            root.send(focusEvent(e.currentTarget, env.modality))
        },
        onFocusOut: () => root.send(blurEvent(env.modality)),
      }),
    )
    this.carrierProps = computed(() => root.api().hiddenInput())
    bindProps(() =>
      joinHandlers(root.api().control(), {
        onPointerLeave: () => root.send({ type: "POINTER.LEAVE" }),
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The modality tracker must see the pointerdown that comes before the input's focus.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/** One star: `<span rindRatingItem [index]="i">`; `data-state` full, half or empty. */
@Directive({ selector: "[rindRatingItem]", exportAs: "rindRatingItem" })
export class RatingItem {
  /** The star's position, 1 to `count` (known on the server). */
  readonly index = input.required<number>()

  constructor() {
    const root = injectRating("Item")
    let released = false
    const fraction = (e: { currentTarget: EventTarget | null; clientX: number }) =>
      e.currentTarget instanceof Element
        ? ratingFraction(e.currentTarget.getBoundingClientRect(), e.clientX, root.direction())
        : 1
    bindProps(
      () =>
        joinHandlers(root.api().item(this.index()), {
          onPointerMove: (e: PointerEvent) => {
            // No hover on touch: a tap sets the value directly.
            if (e.pointerType === "touch") return
            root.send({ type: "POINTER.MOVE", index: this.index(), fraction: fraction(e) })
          },
          // The range input keeps focus: a press on a star must not blur it.
          onPointerDown: (e: PointerEvent) => e.preventDefault(),
          // Activation on release, where the pointer is: a tap, a click, or a half of a star.
          onPointerUp: (e: PointerEvent) => {
            if (e.button !== 0) return
            released = true
            root.send({
              type: "PRESS",
              index: this.index(),
              fraction: fraction(e),
              modality: e.pointerType === "touch" ? "touch" : "pointer",
            })
          },
          // A bare click (assistive technology, a script): no pointer before it, a whole star.
          onClick: (e: MouseEvent) => {
            // The click that follows a release is that release's (already pressed).
            const after = released
            released = false
            if (after || e.detail !== 0) return
            root.send({ type: "PRESS", index: this.index(), fraction: 1, modality: "virtual" })
          },
        }),
      { owns: ["index"] },
    )
  }
}

/** The Rating's parts, for a standalone component's `imports`. */
export const Rating = [RatingRoot, RatingLabel, RatingControl, RatingItem] as const
