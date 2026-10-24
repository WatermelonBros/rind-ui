import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
} from "@angular/core"
import {
  announcerCapability,
  type ButtonMessages,
  type ButtonPressDetails,
  blurEvent,
  buttonConnect,
  buttonMachine,
  buttonMessages,
  focusAttrs,
  focusEvent,
  type MessageOverrides,
  warnInteractiveContent,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectFieldsetDisabled } from "../fieldset/context"
import { CONTROL_OVERRIDE } from "../hosted-control"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment, injectMessages } from "../provider"

export interface ButtonState {
  readonly pending: boolean
  readonly disabled: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

/** `undefined` stays undefined (the default); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A button: `<button rindButton (press)="save()">Save</button>`, or a link that looks like one
 * (`<a rindButton href="/docs/">`). Read its state through `#b="rindButton"` (`b.state()`).
 */
@Directive({ selector: "[rindButton]", exportAs: "rindButton" })
export class Button {
  /** Default "button": never submits a form by accident. */
  readonly type = input<"button" | "submit" | "reset">()
  /** Ignores activation: native `disabled` on a `<button>`, `aria-disabled` elsewhere. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Keeps a disabled Button in the Tab order (`aria-disabled` instead of `disabled`). */
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  /** Ignores activation, keeps focus, announces `messages.pending` when focused. */
  readonly pending = input(false, { transform: booleanAttribute })
  /** `false`: a press activates without moving focus. */
  readonly focusOnPress = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** On an `<a>`: the link's target (resolved, or none while disabled). */
  readonly href = input<string>()
  /** Overrides the announced texts. Default: `pending: "Loading"`. */
  readonly messages = input<MessageOverrides<ButtonMessages>>()
  readonly id = input<string>()
  /** Once per activation, with `modality` and the modifier keys. */
  readonly press = output<ButtonPressDetails>()
  /** A press starts. */
  readonly pressStart = output<ButtonPressDetails>()
  /** A press ends, also when cancelled or released outside. */
  readonly pressEnd = output<ButtonPressDetails>()

  /** The button's state, for the template. */
  readonly state: () => ButtonState

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const el: HTMLElement = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    // Composed by another part (a Toolbar's Button): it decides these.
    const control = inject(CONTROL_OVERRIDE, { optional: true, self: true })
    const ownDisabled = () => control?.source.disabled?.() ?? this.disabled()
    const keepsFocus = () =>
      control?.source.focusableWhenDisabled?.() ?? this.focusableWhenDisabled()
    const ownId = () => (control?.source.id ? control.source.id() : this.id())
    const instance = injectRootId(ownId)
    const messages = injectMessages("button", buttonMessages, () => this.messages())
    // A rind-ui Fieldset's injection reaches portalled parts; the DOM tracker native fieldsets.
    const fieldsetContext = injectFieldsetDisabled()
    const { view, send } = injectMachine(
      buttonMachine,
      () => ({
        // The machine guards activation on it as on the input.
        disabled: ownDisabled() || fieldsetContext(),
        pending: this.pending(),
        onPress: (d: ButtonPressDetails) => this.press.emit(d),
        onPressStart: (d: ButtonPressDetails) => this.pressStart.emit(d),
        onPressEnd: (d: ButtonPressDetails) => this.pressEnd.emit(d),
        messages: messages(),
        id: instance(),
      }),
      env,
    )
    const disabled = computed(
      () => ownDisabled() || view().context.fieldsetDisabled || fieldsetContext(),
    )
    // Server and hydration render without it, like React's server snapshot.
    const origin = signal<string | undefined>(undefined)
    const press = injectPress({
      env,
      // Button opts into neither long press nor a context menu of its own.
      send: (e) => {
        if (e.type !== "CONTEXT_MENU" && e.type !== "LONG_PRESS") send(e)
      },
      disabled: () => disabled() || this.pending(),
      // Read at event time: the input is set after the constructor. Core checks only `false`.
      get focusOnPress() {
        return focusOnPress() ?? true
      },
    })
    const focusOnPress = () => this.focusOnPress()
    const hover = injectHover({ env, send: () => {}, disabled: () => disabled() })
    const focused = computed(() => view().context.focused)
    const modality = injectModality(env.modality, focused)
    this.state = computed<ButtonState>(() => ({
      pending: this.pending(),
      disabled: disabled(),
      pressed: press.pressed(),
      hovered: hover.hovered(),
      focusVisible: focusAttrs(focused(), modality())["data-focus-visible"] !== undefined,
    }))
    bindProps(
      () => ({
        ...joinHandlers(
          buttonConnect(
            {
              instance: instance(),
              tag,
              href: this.href(),
              origin: origin(),
              disabled: disabled(),
              focusableWhenDisabled: keepsFocus(),
              pending: this.pending(),
              type: this.type(),
              focused: focused(),
              modality: modality(),
              pressed: press.pressed(),
              hovered: hover.hovered(),
            },
            env,
          ),
          press.props,
          hover.props,
          {
            onFocusIn: (e: FocusEvent) =>
              send(focusEvent(e.currentTarget as Element, env.modality)),
            onFocusOut: () => send(blurEvent(env.modality)),
          },
        ),
        ...(ownId() === undefined ? {} : { id: ownId() }),
      }),
      {
        owns: [
          "disabled",
          "focusablewhendisabled",
          "focusonpress",
          "href",
          "id",
          "pending",
          "type",
        ],
      },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      origin.set(globalThis.location?.origin)
      // The modality tracker must see the pointerdown that comes before focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      warnInteractiveContent(el, "button")
      const watch = watchFieldsetDisabled(el, (d) => send({ type: "FIELDSET.CHANGE", disabled: d }))
      if (watch.disabled) send({ type: "FIELDSET.CHANGE", disabled: true })
      destroy.onDestroy(() => watch.stop())
    })
  }
}
