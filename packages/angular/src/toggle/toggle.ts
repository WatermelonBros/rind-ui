import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
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
  signal,
} from "@angular/core"
import {
  accessibleNameOf,
  blurEvent,
  checkStableName,
  focusEvent,
  type ToggleEvent,
  toggleConnect,
  toggleMachine,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"

declare const process: { env: { NODE_ENV?: string } }

export interface ToggleState {
  readonly pressed: boolean
  readonly disabled: boolean
}

/** `undefined` stays undefined (uncontrolled); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

const TOGGLE = new InjectionToken<ToggleRoot>("rind-ui.toggle")

/**
 * A two-state button: `<button rindToggleRoot [(pressed)]="bold">Bold</button>`. Read its state
 * in the template through `#t="rindToggleRoot"` (`t.state().pressed`).
 */
@Directive({
  selector: "[rindToggleRoot]",
  exportAs: "rindToggleRoot",
  providers: [{ provide: TOGGLE, useExisting: forwardRef(() => ToggleRoot) }],
})
export class ToggleRoot {
  /** Controlled pressed state (`[(pressed)]`). */
  readonly pressed = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Uncontrolled initial state. Default: false. */
  readonly defaultPressed = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Stays in the tab order while disabled (`aria-disabled`), e.g. for a tooltip. */
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  readonly id = input<string>()
  /** Every activation proposes the opposite value; `details.cancel()` vetoes it. */
  readonly pressedChangeDetails = output<ChangeEvent<boolean, ToggleEvent>>()
  /** The accepted value, for `[(pressed)]`. */
  readonly pressedChange = output<boolean>()

  private readonly emit = changeEmitter<boolean, ToggleEvent>(
    this.pressedChangeDetails,
    this.pressedChange,
  )
  private readonly fieldsetContext = injectFieldsetDisabled()
  private readonly fieldsetDom = signal(false)
  private readonly isDisabled = computed(
    () => this.disabled() || this.fieldsetContext() || this.fieldsetDom(),
  )
  private readonly machine = injectMachine(toggleMachine, () => ({
    pressed: this.pressed(),
    defaultPressed: this.defaultPressed(),
    onPressedChange: this.emit,
  }))
  private readonly on = computed(() => this.machine.view().matches("on"))

  /** The toggle's state, for the template. */
  readonly state = computed<ToggleState>(() => ({
    pressed: this.on(),
    disabled: this.isDisabled(),
  }))

  /** @internal The connect output, read by the parts. */
  readonly api: () => ReturnType<typeof toggleConnect>

  constructor() {
    const env = injectEnvironment()
    const el: HTMLElement = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const instance = injectRootId(() => this.id())
    const { send } = this.machine
    const press = injectPress({
      env,
      // Only the activation toggles; disabled sends nothing (no guard in the machine).
      send: (e) => {
        // A PressEvent's `type` is the PressEventType union; this one is checked to be "PRESS".
        if (e.type === "PRESS") send(e as Extract<typeof e, { type: "PRESS" }>)
      },
      disabled: () => this.isDisabled(),
    })
    const hover = injectHover({ env, send: () => {}, disabled: () => this.isDisabled() })
    const focused = computed(() => this.machine.view().context.focused)
    const modality = injectModality(env.modality, focused)
    const api = computed(() =>
      toggleConnect(
        {
          instance: instance(),
          tag,
          on: this.on(),
          disabled: this.isDisabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          focused: focused(),
          modality: modality(),
          pressed: press.pressed(),
          hovered: hover.hovered(),
        },
        env,
      ),
    )
    this.api = api
    bindProps(
      () => ({
        ...joinHandlers(api().root(), press.props, hover.props, {
          onFocusIn: (e: FocusEvent) => send(focusEvent(e.currentTarget as Element, env.modality)),
          onFocusOut: () => send(blurEvent(env.modality)),
        }),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      { owns: ["defaultpressed", "disabled", "focusablewhendisabled", "id", "pressed"] },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      // The modality tracker must see the pointerdown that comes before focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
      const watcher = watchFieldsetDisabled(el, (d) => this.fieldsetDom.set(d))
      this.fieldsetDom.set(watcher.disabled)
      destroy.onDestroy(() => watcher.stop())
    })
    let named: { name: string; on: boolean } | undefined
    afterRenderEffect(() => {
      const on = this.on()
      if (process.env.NODE_ENV === "production" || named?.on === on) return
      const current = { name: accessibleNameOf(el), on }
      checkStableName(named, current)
      named = current
    })
  }
}

/**
 * Follows the toggle's state (`data-state`): `<span rindToggleIndicator>`. Show content while
 * pressed with `@if (t.state().pressed)`.
 */
@Directive({ selector: "[rindToggleIndicator]", exportAs: "rindToggleIndicator" })
export class ToggleIndicator {
  constructor() {
    const root = inject(TOGGLE, { optional: true })
    if (!root) throw new Error("rindToggleIndicator must be inside rindToggleRoot")
    bindProps(() => root.api().indicator())
  }
}

/** The Toggle's directives, for a standalone component's `imports`. */
export const Toggle = [ToggleRoot, ToggleIndicator] as const
