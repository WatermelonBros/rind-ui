import {
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
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type MessageOverrides,
  type TimerAction,
  type TimerMessages,
  type TimerState,
  type TimerTickDetails,
  type TimerTime,
  type TimerUnit,
  timerActionEvent,
  timerConfig,
  timerConnect,
  timerMachine,
  timerMessages,
  visibilityCapability,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

/** The timer's state, for the template (`#t="rindTimerRoot"`, `t.state()`). */
export interface TimerRenderState {
  readonly state: TimerState
  /** The displayed units. */
  readonly time: TimerTime
  /** 0–1 from start to target (0 without a target). */
  readonly progress: number
}

/** An ActionTrigger's state (`#a="rindTimerActionTrigger"`, `a.state().label`). */
export interface TimerActionTriggerRenderState {
  readonly action: TimerAction
  /** The toggle's word for the current state ("Start", "Pause", "Resume"). */
  readonly label: string
  /** The action does nothing in the current state. */
  readonly disabled: boolean
}

const TIMER = new InjectionToken<TimerRoot>("rind-ui.timer")

function injectTimer(part: string): TimerRoot {
  const root = inject(TIMER, { optional: true })
  if (!root) throw new Error(`rindTimer${part} must be inside rindTimerRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))

/**
 * A stopwatch or a countdown: `<div rindTimerRoot [countdown]="true" [startMs]="60000">` with
 * an Area (`role="timer"`) holding Items and a Control holding ActionTriggers.
 */
@Directive({
  selector: "[rindTimerRoot]",
  exportAs: "rindTimerRoot",
  providers: [{ provide: TIMER, useExisting: forwardRef(() => TimerRoot) }],
})
export class TimerRoot {
  /** Count down from `startMs` to `targetMs` instead of up. */
  readonly countdown = input(false, { transform: booleanAttribute })
  /** Where the timer starts (ms). Default 0. */
  readonly startMs = input(undefined, { transform: optionalNumber })
  /** Where it completes (ms). A countdown defaults to 0; a stopwatch without it never completes. */
  readonly targetMs = input(undefined, { transform: optionalNumber })
  /** Runs from the first render. */
  readonly autoStart = input(false, { transform: booleanAttribute })
  /** The display step and tick period (ms). Default 1000. */
  readonly interval = input(undefined, { transform: optionalNumber })
  readonly messages = input<MessageOverrides<TimerMessages>>()
  /** Default: the provider's locale (digits and the spoken duration). */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** Every tick while running. */
  readonly tick = output<TimerTickDetails>()
  /** Once, when the target is reached. */
  readonly complete = output<void>()
  readonly stateChange = output<TimerState>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof timerConnect>>
  /** @internal Runs `action` when it applies in the current state. */
  readonly run: (action: TimerAction) => void
  readonly state: Signal<TimerRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability, visibilityCapability)
    const messages = injectMessages("timer", timerMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    const machineProps = () => ({
      countdown: this.countdown(),
      startMs: this.startMs(),
      targetMs: this.targetMs(),
      autoStart: this.autoStart(),
      interval: this.interval(),
      messages: messages(),
      id: instance(),
      lang: locale().locale,
      onTick: (d: TimerTickDetails) => this.tick.emit(d),
      onComplete: () => this.complete.emit(),
      onStateChange: (s: TimerState) => this.stateChange.emit(s),
    })
    const { view, send } = injectMachine(timerMachine, machineProps, env)
    this.api = computed(() =>
      timerConnect(
        {
          instance: instance(),
          state: view().state,
          value: view().context.value,
          config: timerConfig(machineProps()),
          locale: locale().locale,
          messages: messages(),
        },
        env,
      ),
    )
    this.run = (action) => {
      if (this.api().applies(action)) send(timerActionEvent(action))
    }
    this.state = computed(() => ({
      state: view().state,
      time: this.api().time,
      progress: this.api().progress,
    }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "autostart",
          "countdown",
          "id",
          "interval",
          "locale",
          "messages",
          "startms",
          "targetms",
        ],
      },
    )
  }
}

/** `role="timer"`, named by the time in words; holds the Items and Separators. */
@Directive({ selector: "[rindTimerArea]", exportAs: "rindTimerArea" })
export class TimerArea {
  constructor() {
    const root = injectTimer("Area")
    bindProps(() => root.api().area())
  }
}

/** Groups the ActionTriggers. */
@Directive({ selector: "[rindTimerControl]", exportAs: "rindTimerControl" })
export class TimerControl {
  constructor() {
    const root = injectTimer("Control")
    bindProps(() => root.api().control())
  }
}

/** One unit (`type`): days, hours, minutes, seconds or milliseconds. */
@Directive({ selector: "[rindTimerItem]", exportAs: "rindTimerItem" })
export class TimerItem {
  readonly type = input.required<TimerUnit>()
  constructor() {
    const root = injectTimer("Item")
    bindProps(() => root.api().item(this.type()), { owns: ["type"] })
  }
}

/** The unit's value in the locale's digits ("05"): its content, or the value. */
@Component({
  selector: "[rindTimerItemValue]",
  exportAs: "rindTimerItemValue",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class TimerItemValue {
  readonly type = input.required<TimerUnit>()
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectTimer("ItemValue")
    this.text = computed(() => root.api().text(this.type()))
    bindProps(() => root.api().itemValue(this.type()), { owns: ["type"] })
  }
}

/** A visible caption for the unit ("min"). */
@Directive({ selector: "[rindTimerItemLabel]", exportAs: "rindTimerItemLabel" })
export class TimerItemLabel {
  readonly type = input.required<TimerUnit>()
  constructor() {
    const root = injectTimer("ItemLabel")
    bindProps(() => root.api().itemLabel(this.type()), { owns: ["type"] })
  }
}

/** `aria-hidden` punctuation between Items (":"). */
@Directive({ selector: "[rindTimerSeparator]", exportAs: "rindTimerSeparator" })
export class TimerSeparator {
  constructor() {
    const root = injectTimer("Separator")
    bindProps(() => root.api().separator())
  }
}

/**
 * Runs `action` on press: `<button rindTimerActionTrigger action="toggle">`. An action that does
 * nothing now is `aria-disabled` but stays focusable: the focus never drops.
 */
@Directive({ selector: "[rindTimerActionTrigger]", exportAs: "rindTimerActionTrigger" })
export class TimerActionTrigger {
  readonly action = input.required<TimerAction>()
  readonly state: Signal<TimerActionTriggerRenderState>
  constructor() {
    const root = injectTimer("ActionTrigger")
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const native = tag === "button" || tag === "input"
    const env = injectEnvironment()
    // Tracks the modality from the first render, so the first keyboard focus is already visible.
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    }
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    this.state = computed(() => ({
      action: this.action(),
      label: root.api().toggleLabel(),
      disabled: !root.api().applies(this.action()),
    }))
    bindProps(
      () =>
        joinHandlers(
          root.api().actionTrigger({
            action: this.action(),
            tag,
            focused: focused(),
            modality: modality(),
          }),
          {
            onClick: () => root.run(this.action()),
            // A non-button element: Enter and Space click it, as a button would.
            onKeyDown: (e: KeyboardEvent) => {
              if (native || e.repeat) return
              if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
              if (e.key === " ") e.preventDefault()
            },
            onKeyUp: (e: KeyboardEvent) => {
              if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
            },
            onFocusIn: () => focused.set(true),
            onFocusOut: () => focused.set(false),
          },
        ),
      { owns: ["action"] },
    )
  }
}

/** The Timer's parts, for a standalone component's `imports`. */
export const Timer = [
  TimerRoot,
  TimerArea,
  TimerControl,
  TimerItem,
  TimerItemValue,
  TimerItemLabel,
  TimerSeparator,
  TimerActionTrigger,
] as const
