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
} from "@angular/core"
import {
  adjacentStep,
  announcerCapability,
  type ChangeDetails,
  focusSafely,
  type MessageOverrides,
  partId,
  type StepperChangeDetails,
  type StepperChangeReason,
  type StepperEvent,
  type StepperMessages,
  type StepperOrientation,
  stepperConnect,
  stepperMachine,
  stepperMessages,
  stepReachable,
  stepStatus,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

/** The stepper's state, for the template (`#s="rindStepperRoot"`, `s.state()`). */
export interface StepperRenderState {
  readonly step: number
  readonly count: number
  readonly orientation: StepperOrientation
}

const STEPPER = new InjectionToken<StepperRoot>("rind-ui.stepper")
const ITEM = new InjectionToken<StepperItem>("rind-ui.stepper-item")

function injectStepper(part: string): StepperRoot {
  const root = inject(STEPPER, { optional: true })
  if (!root) throw new Error(`rindStepper${part} must be inside rindStepperRoot`)
  return root
}
function injectItem(part: string): StepperItem {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindStepper${part} must be inside rindStepperItem`)
  return item
}

/** A focusable part's own focus, tracked from the first render (the focusing press is known). */
function injectFocusState() {
  const env = injectEnvironment()
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  return {
    focus: () => ({ focused: focused(), modality: modality() }),
    handlers: {
      onFocusIn: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused.set(true)
      },
      onFocusOut: (e: FocusEvent) => {
        if (e.target === e.currentTarget) focused.set(false)
      },
    },
  }
}

/** A map signal with per-key register / unregister. */
function registryState<V>() {
  const map = signal<ReadonlyMap<number, V>>(new Map())
  const put = (index: number, value: V | undefined) => {
    const m = untracked(map)
    if (!(value === undefined ? !m.has(index) : m.get(index) === value)) {
      const next = new Map(m)
      if (value === undefined) next.delete(index)
      else next.set(index, value)
      map.set(next)
    }
    return () => {
      const now = untracked(map)
      if (!now.has(index)) return
      const next = new Map(now)
      next.delete(index)
      map.set(next)
    }
  }
  return [map.asReadonly(), put] as const
}

/**
 * Steps of a task: `<div rindStepperRoot [count]="3" aria-label="Checkout">` with an
 * `<ol rindStepperList>` of `<li rindStepperItem [index]="i">` steps, one Content per step and
 * the Prev / Next triggers.
 */
@Directive({
  selector: "[rindStepperRoot]",
  exportAs: "rindStepperRoot",
  providers: [{ provide: STEPPER, useExisting: forwardRef(() => StepperRoot) }],
})
export class StepperRoot {
  /** How many steps. */
  readonly count = input.required<number>()
  /** Controlled current step, 0-based (`[(step)]`). */
  readonly step = input<number>()
  readonly defaultStep = input<number>()
  /** Back to any visited step; forward only with NextTrigger (default true). */
  readonly linear = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  readonly orientation = input<StepperOrientation>("horizontal")
  readonly messages = input<MessageOverrides<StepperMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** `details.reason`: "next", "prev" or "select"; `details.cancel()` refuses it. */
  readonly stepChangeDetails = output<{ value: number; details: StepperChangeDetails }>()
  /** The accepted step, for `[(step)]`. */
  readonly stepChange = output<number>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof stepperConnect>>
  /** @internal */
  readonly send: (event: StepperEvent) => void
  /** @internal */
  readonly texts: Signal<StepperMessages>
  /** @internal */
  readonly putDisabled: (index: number, on: true | undefined) => () => void
  /** @internal */
  readonly putCompleted: (index: number, value: boolean | undefined) => () => void
  /** @internal */
  readonly putTitle: (index: number, text: string | undefined) => () => void
  readonly state: Signal<StepperRenderState>

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    const locale = injectLocale(() => this.locale())
    const messages = injectMessages("stepper", stepperMessages, () => this.messages())
    this.texts = messages
    const [disabledMap, putDisabled] = registryState<true>()
    const [completedMap, putCompleted] = registryState<boolean>()
    const [titleMap, putTitle] = registryState<string>()
    this.putDisabled = putDisabled
    this.putCompleted = putCompleted
    this.putTitle = putTitle
    const contentId = (i: number) => partId("stepper", instance(), `content-${i}`)
    const disabledSteps = computed(() => new Set(disabledMap().keys()))
    const machineProps = () => ({
      id: instance(),
      count: this.count(),
      step: this.step(),
      defaultStep: this.defaultStep(),
      onStepChange: (next: number, d: ChangeDetails<StepperEvent>) => {
        let cancelled = false
        // Sound: every step-writing transition declares one of these reasons (machine).
        this.stepChangeDetails.emit({
          value: next,
          details: {
            ...d,
            reason: d.reason as unknown as StepperChangeReason,
            cancel: () => {
              cancelled = true
              d.cancel()
            },
          },
        })
        if (!cancelled) this.stepChange.emit(next)
      },
      linear: this.linear(),
      disabledSteps: disabledSteps(),
      completedSteps: completedMap(),
      titles: titleMap(),
      messages: messages(),
      lang: locale().locale,
    })
    const { view, send } = injectMachine(stepperMachine, machineProps, {
      ...env,
      focusContent: (index: number) => {
        // The press's modality, read now: the focus lands a frame later (after the render that
        // shows the step), when the tracker no longer knows what caused it.
        const modality = env.modality.modality()
        env.scheduler.requestAnimationFrame(() => {
          const el = document.getElementById(untracked(() => contentId(index)))
          if (el) void focusSafely(el, env, "programmatic", modality)
        })
      },
    })
    this.send = send
    this.api = computed(() => {
      const p = machineProps()
      const current = view().values.step
      return stepperConnect({
        instance: instance(),
        step: current,
        count: this.count(),
        orientation: this.orientation(),
        status: (i) => stepStatus(p, current, i),
        reachable: (i) => stepReachable(p, view().context, current, i),
        disabled: (i) => disabledSteps().has(i),
        title: (i) => titleMap().get(i) ?? "",
        hasNext: adjacentStep(p, current, 1) !== null,
        hasPrev: adjacentStep(p, current, -1) !== null,
        ids: {
          content: contentId,
          description: (i) => partId("stepper", instance(), `description-${i}`),
        },
        messages: messages(),
        locale: locale().locale,
      })
    })
    this.state = computed(() => ({
      step: view().values.step,
      count: this.count(),
      orientation: this.orientation(),
    }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: ["count", "defaultstep", "id", "linear", "locale", "messages", "orientation", "step"],
      },
    )
  }
}

/** The `<ol>` of steps. */
@Directive({ selector: "[rindStepperList]", exportAs: "rindStepperList" })
export class StepperList {
  constructor() {
    const root = injectStepper("List")
    bindProps(() => root.api().list())
  }
}

/**
 * A step: `<li rindStepperItem [index]="0" #i="rindStepperItem">`. Its Trigger is a button when
 * the user can reach the step, text otherwise (no dead tab stop): render
 * `<button rindStepperTrigger>` or `<span rindStepperTrigger>` by `i.triggerIsButton()`.
 */
@Directive({
  selector: "[rindStepperItem]",
  exportAs: "rindStepperItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => StepperItem) }],
})
export class StepperItem {
  /** The step's index (0-based). */
  readonly index = input.required<number>()
  /** The step cannot be visited; Next and Previous skip it. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Overrides the status: completed (true) or not (false) whatever the current step. */
  readonly completed = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** Whether the step's Trigger is a button (the user can reach the step). */
  readonly triggerIsButton: Signal<boolean>
  /** @internal A Description is rendered: the Trigger is described by it. */
  readonly described = signal(false)

  constructor() {
    const root = injectStepper("Item")
    this.triggerIsButton = computed(() => root.api().triggerIsButton(this.index()))
    bindProps(() => root.api().item(this.index()), {
      owns: ["completed", "disabled", "index"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // Registered after the first render, as React (the server HTML lacks them).
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const index = this.index()
      const on = this.disabled()
      onCleanup(untracked(() => root.putDisabled(index, on ? true : undefined)))
    })
    effect((onCleanup) => {
      if (!ready()) return
      const index = this.index()
      const completed = this.completed()
      onCleanup(untracked(() => root.putCompleted(index, completed)))
    })
  }
}

/**
 * Selects its step: `<button rindStepperTrigger>` while reachable, `<span>` otherwise; it
 * renders the step's status text after its content.
 */
@Component({
  selector: "[rindStepperTrigger]",
  exportAs: "rindStepperTrigger",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content /><span [rindProps]="statusProps()">{{ statusText() }}</span>`,
})
export class StepperTrigger {
  /** @internal */
  protected readonly statusProps: Signal<
    ReturnType<ReturnType<typeof stepperConnect>["statusProps"]>
  >
  /** @internal */
  protected readonly statusText: Signal<string>

  constructor() {
    const root = injectStepper("Trigger")
    const item = injectItem("Trigger")
    const { focus, handlers } = injectFocusState()
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    this.statusProps = computed(() => root.api().statusProps())
    this.statusText = computed(() => root.api().statusText(item.index()))
    bindProps(() => {
      const api = root.api()
      const index = item.index()
      return joinHandlers(api.trigger(index, item.described(), focus()), {
        ...handlers,
        ...(tag === "button" && api.triggerIsButton(index)
          ? { onClick: () => root.send({ type: "SELECT", index }) }
          : {}),
      })
    })
  }
}

/** The step's number or check mark. */
@Directive({ selector: "[rindStepperIndicator]", exportAs: "rindStepperIndicator" })
export class StepperIndicator {
  constructor() {
    const root = injectStepper("Indicator")
    const item = inject(ITEM, { optional: true })
    bindProps(() => root.api().indicator(item?.index() ?? 0))
  }
}

/** The step's title: its text names the announcement and the content region. */
@Directive({ selector: "[rindStepperTitle]", exportAs: "rindStepperTitle" })
export class StepperTitle {
  constructor() {
    const root = injectStepper("Title")
    const item = injectItem("Title")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() => root.api().title(item.index()))
    if (inject(PLATFORM_ID) !== "browser") return
    let at: number | undefined
    afterEveryRender(() => {
      const index = untracked(item.index)
      if (at !== undefined && at !== index) root.putTitle(at, undefined)
      at = index
      const text = el.textContent?.trim() ?? ""
      root.putTitle(index, text || undefined)
    })
    inject(DestroyRef).onDestroy(() => {
      if (at !== undefined) root.putTitle(at, undefined)
    })
  }
}

/** Help text for the step; its Trigger is described by it. */
@Directive({ selector: "[rindStepperDescription]", exportAs: "rindStepperDescription" })
export class StepperDescription {
  constructor() {
    const root = injectStepper("Description")
    const item = injectItem("Description")
    bindProps(() => root.api().description(item.index()))
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => item.described.set(true))
    inject(DestroyRef).onDestroy(() => item.described.set(false))
  }
}

/** The line between this step and the next. */
@Directive({ selector: "[rindStepperSeparator]", exportAs: "rindStepperSeparator" })
export class StepperSeparator {
  constructor() {
    const root = injectStepper("Separator")
    const item = inject(ITEM, { optional: true })
    bindProps(() => root.api().separator(item?.index() ?? 0))
  }
}

/** Step `index`'s content, shown while it is the current step. */
@Directive({ selector: "[rindStepperContent]", exportAs: "rindStepperContent" })
export class StepperContent {
  /** The step this content belongs to (0-based). */
  readonly index = input.required<number>()
  constructor() {
    const root = injectStepper("Content")
    const { focus, handlers } = injectFocusState()
    bindProps(() => joinHandlers(root.api().content(this.index(), focus()), handlers), {
      owns: ["index"],
    })
  }
}

/** Previous / Next: their content, or the messages' labels. */
@Directive()
abstract class NavTrigger {
  /** @internal */
  protected label: Signal<string> = signal("")
  protected wire(next: boolean): void {
    const root = injectStepper(next ? "NextTrigger" : "PrevTrigger")
    const { focus, handlers } = injectFocusState()
    this.label = computed(() => (next ? root.texts().nextLabel : root.texts().prevLabel))
    bindProps(() => {
      const api = root.api()
      return joinHandlers(next ? api.nextTrigger(focus()) : api.prevTrigger(focus()), {
        ...handlers,
        onClick: () => root.send({ type: next ? "NEXT" : "PREV" }),
      })
    })
  }
}

@Component({
  selector: "[rindStepperPrevTrigger]",
  exportAs: "rindStepperPrevTrigger",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ label() }}</ng-content>",
})
export class StepperPrevTrigger extends NavTrigger {
  constructor() {
    super()
    this.wire(false)
  }
}

@Component({
  selector: "[rindStepperNextTrigger]",
  exportAs: "rindStepperNextTrigger",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ label() }}</ng-content>",
})
export class StepperNextTrigger extends NavTrigger {
  constructor() {
    super()
    this.wire(true)
  }
}

/** "Step 2 of 3": its content, or the messages' text. */
@Component({
  selector: "[rindStepperProgress]",
  exportAs: "rindStepperProgress",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class StepperProgress {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectStepper("Progress")
    this.text = computed(() => root.api().progressText)
    bindProps(() => root.api().progress())
  }
}

/** The Stepper's parts, for a standalone component's `imports`. */
export const Stepper = [
  StepperRoot,
  StepperList,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
  StepperContent,
  StepperPrevTrigger,
  StepperNextTrigger,
  StepperProgress,
] as const
