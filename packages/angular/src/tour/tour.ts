// Tour: a guided tour over the page, steps that point at real elements or centred dialogs.
// `injectTour` owns the machine; Root provides it (its own, or a `tour` handle) to the parts.
// Wiring only: the machine owns the run, the core parts own every attribute.
import {
  afterEveryRender,
  afterNextRender,
  Component,
  computed,
  Directive,
  ElementRef,
  type EmbeddedViewRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  domPositioning,
  type FocusTarget,
  type HeadingLevel,
  isAnchoredTourStep,
  isStepModal,
  type MessageOverrides,
  type PartProps,
  partId,
  resolveStep,
  type Service,
  type TourAction,
  type TourCloseReason,
  type TourContext,
  type TourDirection,
  type TourMachineState,
  type TourMessages,
  type TourMissingTarget,
  type TourProps,
  type TourSpotlightOptions,
  type TourStep,
  tourConnect,
  tourIds,
  tourLayerId,
  tourMachine,
  tourMessages,
  tourProgress,
  tourStepIndex,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { HEADING_LEVEL } from "../heading/heading"
import { injectRootId } from "../ids"
import { injectButton } from "../inject-button"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality } from "../inject-press"
import { injectLayerMeta, injectParentLayer, LAYER, layerProvider } from "../layer-context"
import { PORTAL_PROVIDERS, PortalBase } from "../portal"
import { injectEnvironment, injectMessages, withCapabilities } from "../provider"

/** A step (its title and description are text). */
export type TourStepDef = TourStep<string>

/** What `openChangeDetails` carries. */
export interface TourOpenChangeDetails {
  readonly reason: TourCloseReason | "api"
  readonly stepId: string | null
  readonly stepIndex: number
  /** True only for reason `complete`. */
  readonly complete: boolean
  cancel(): void
}

/** What `stepChangeDetails` carries. */
export interface TourStepChangeDetails {
  readonly stepIndex: number
  /** Steps that are not wait steps. */
  readonly totalSteps: number
  /** 0–1, over the steps that are not wait steps. */
  readonly progress: number
  readonly direction: TourDirection
  readonly reason: "start" | "next" | "prev" | "goto"
  cancel(): void
}

export type InjectTourOptions = Omit<
  TourProps,
  "root" | "parent" | "steps" | "messages" | "onOpenChange" | "stepId" | "onStepIdChange"
> & {
  /** Base for the ids of the tour's parts. Default: generated. */
  readonly id?: string | undefined
  readonly steps: readonly TourStepDef[]
  readonly stepId?: string | null | undefined
  readonly onOpenChange?: ((open: boolean, details: TourOpenChangeDetails) => void) | undefined
  readonly onStepChange?: ((stepId: string, details: TourStepChangeDetails) => void) | undefined
  readonly messages?: MessageOverrides<TourMessages> | undefined
}

/** What `injectTour` returns and `rindTourRoot [tour]` accepts; its getters are signal reads. */
export interface TourHandle {
  readonly service: () => Service<typeof tourMachine>
  readonly view: Signal<ReturnType<Service<typeof tourMachine>["view"]>>
  readonly root: string
  readonly props: TourProps
  readonly messages: TourMessages
  /** The tour runs (a step is prepared, shown or waited on). */
  readonly open: boolean
  /** The shown step's id, or null. */
  readonly stepId: string | null
  /** The shown step's 0-based index, or -1. */
  readonly stepIndex: number
  readonly steps: readonly TourStepDef[]
  /** Opens at the first step, or at `stepId`; while open, goes to that step. */
  start(options?: { readonly stepId?: string }): void
  /** Ends the tour with reason `api`. */
  stop(): void
  next(): void
  prev(): void
  goto(id: string): void
  /** Recomputes the card and spotlight now (a target that moved without any event). */
  reposition(): void
  setSteps(steps: readonly TourStepDef[]): void
  addStep(step: TourStepDef, index?: number): void
  removeStep(id: string): void
  updateStep(id: string, patch: Partial<Omit<TourStepDef, "id">>): void
}

const reasonOf = (direction: TourDirection, started: boolean) =>
  started ? "start" : direction === "jump" ? "goto" : direction === "backward" ? "prev" : "next"

/**
 * The tour's API: pass it to `<ng-container rindTourRoot [tour]="tour">`, or give the Root the
 * tour's inputs. Call it in an injection context (a field initializer, a constructor).
 */
export function injectTour(options: () => InjectTourOptions): TourHandle {
  const root = injectRootId(() => options().id)
  const parent = injectParentLayer()
  const messages = injectMessages("tour", tourMessages, () => options().messages)
  const env = injectEnvironment(announcerCapability)
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = withCapabilities(env, { position: domPositioning(env) })
  // The steps: the option, or what the mutators set since it last changed.
  const override = signal<{ from: readonly TourStepDef[]; list: readonly TourStepDef[] } | null>(
    null,
  )
  const steps = () => {
    const given = options().steps
    const own = override()
    return own && own.from === given ? own.list : given
  }
  const set = (list: readonly TourStepDef[]) =>
    override.set({ from: untracked(() => options().steps), list })
  let service: (() => Service<typeof tourMachine>) | null = null
  const read = () => {
    const s = service?.()
    return {
      shown: (s?.view().values.stepId as string | undefined) || null,
      context: s?.getSnapshot().context as TourContext | undefined,
    }
  }
  const props = (): TourProps => {
    const {
      id: _id,
      steps: _steps,
      messages: _messages,
      onOpenChange,
      onStepChange,
      stepId,
      defaultStepId,
      ...rest
    } = options()
    const list = steps()
    return {
      ...rest,
      root: root(),
      parent: parent(),
      steps: list,
      messages: messages(),
      // Not `defaultStepId`: the first shown step of every run is reported to stepChange.
      ...(defaultStepId === undefined ? {} : { firstStepId: defaultStepId }),
      ...(stepId === undefined ? {} : { stepId: stepId ?? "" }),
      onOpenChange: onOpenChange
        ? (open, d) => {
            const { shown } = read()
            const reason = open ? "api" : (d.reason as TourCloseReason)
            onOpenChange(open, {
              reason,
              stepId: shown,
              stepIndex: tourStepIndex(list, shown),
              complete: reason === "complete",
              cancel: d.cancel,
            })
          }
        : undefined,
      onStepIdChange: onStepChange
        ? (next, d) => {
            const { shown, context } = read()
            const p = tourProgress(list, next)
            const direction = context?.direction ?? "forward"
            onStepChange(next, {
              stepIndex: tourStepIndex(list, next),
              totalSteps: p.total,
              progress: p.progress,
              direction,
              reason: reasonOf(direction, shown === null),
              cancel: d.cancel,
            })
          }
        : undefined,
    }
  }
  const machine = injectMachine(tourMachine, props, withPosition)
  service = machine.service
  const { view, send } = machine
  const shown = () => (view().values.stepId as string) || null
  return {
    service: machine.service,
    view,
    get root() {
      return root()
    },
    get props() {
      return props()
    },
    get messages() {
      return messages()
    },
    get open() {
      return view().values.open as boolean
    },
    get stepId() {
      return view().matches("idle") ? null : shown()
    },
    get stepIndex() {
      return view().matches("idle") ? -1 : tourStepIndex(steps(), shown())
    },
    get steps() {
      return steps()
    },
    start: (s) => send({ type: "START", stepId: s?.stepId }),
    stop: () => send({ type: "api" }),
    next: () => send({ type: "STEP.NEXT" }),
    prev: () => send({ type: "STEP.PREV" }),
    goto: (to) => send({ type: "STEP.GOTO", id: to }),
    reposition: () => send({ type: "POSITION.REPOSITION" }),
    setSteps: set,
    addStep: (step, index) => {
      const list = [...untracked(steps)]
      list.splice(index ?? list.length, 0, step)
      set(list)
    },
    removeStep: (rid) => set(untracked(steps).filter((x) => x.id !== rid)),
    updateStep: (uid, patch) =>
      set(untracked(steps).map((x) => (x.id === uid ? { ...x, ...patch, id: x.id } : x))),
  }
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

type Extra = {
  dir?: "ltr" | "rtl"
  focusWithin?: boolean
  contentFocused?: boolean
  modality?: Parameters<typeof tourConnect>[0]["modality"]
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

const TOUR = new InjectionToken<TourRoot>("rind-ui.tour")

function injectTourRoot(part: string): TourRoot {
  const root = inject(TOUR, { optional: true })
  if (!root) throw new Error(`rindTour${part} must be inside rindTourRoot`)
  return root
}

/**
 * The tour's provider (no element of its own): `<ng-container rindTourRoot [steps]="steps">`,
 * or `[tour]="handle"` from `injectTour`. Its parts: a Trigger and, in
 * `<ng-template rindTourPortal>`, the Backdrop, the Spotlight and a Positioner holding the
 * Content.
 */
@Directive({
  selector: "[rindTourRoot]",
  exportAs: "rindTourRoot",
  providers: [{ provide: TOUR, useExisting: forwardRef(() => TourRoot) }],
})
export class TourRoot {
  /** A handle from `injectTour`: the Root provides it (its other inputs are then unused). */
  readonly tour = input<TourHandle>()
  readonly id = input<string>()
  readonly steps = input<readonly TourStepDef[]>([])
  /** Controlled run (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** The shown step (`[(stepId)]`). */
  readonly stepId = input<string | null>()
  readonly defaultStepId = input<string>()
  /** Every step modal (a step's own `modal` wins). */
  readonly modal = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true. */
  readonly closeOnEscape = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default false: a stray click does not end the tour. */
  readonly closeOnOutsidePress = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default false. */
  readonly closeOnOutsideFocus = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Arrow keys inside the card move between steps (default true). */
  readonly keyboardNavigation = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Milliseconds a step's target and effect may take (default 5000). */
  readonly prepareTimeout = input<number>()
  readonly preventTargetInteraction = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  readonly spotlight = input<TourSpotlightOptions>()
  /** The first focus on start (default: the content); `false` does not move focus. */
  readonly initialFocus = input<(() => FocusTarget) | null>()
  /** Where focus returns when the tour ends; `false`: it does not move. */
  readonly finalFocus = input<((reason: TourCloseReason | null) => FocusTarget) | false | null>()
  /** Elements whose presses and focus count as inside (a toast). */
  readonly persistentElements = input<() => readonly Element[]>()
  readonly messages = input<MessageOverrides<TourMessages>>()
  /** Every change of the run; `details.cancel()` vetoes it. */
  readonly openChangeDetails = output<{ open: boolean; details: TourOpenChangeDetails }>()
  readonly openChange = output<boolean>()
  /** Every step change; `details.cancel()` vetoes it. */
  readonly stepChangeDetails = output<{ stepId: string; details: TourStepChangeDetails }>()
  readonly stepIdChange = output<string>()
  /** A step's target is missing (its policy decides what follows). */
  readonly missingTarget = output<{ readonly stepId: string; readonly policy: TourMissingTarget }>()

  private readonly own = injectTour(() => ({
    id: this.id(),
    steps: this.steps(),
    open: this.open(),
    defaultOpen: this.defaultOpen(),
    stepId: this.stepId(),
    defaultStepId: this.defaultStepId(),
    modal: this.modal(),
    closeOnEscape: this.closeOnEscape(),
    closeOnOutsidePress: this.closeOnOutsidePress(),
    closeOnOutsideFocus: this.closeOnOutsideFocus(),
    keyboardNavigation: this.keyboardNavigation(),
    prepareTimeout: this.prepareTimeout(),
    preventTargetInteraction: this.preventTargetInteraction(),
    spotlight: this.spotlight(),
    initialFocus: this.initialFocus(),
    finalFocus: this.finalFocus(),
    persistentElements: this.persistentElements(),
    messages: this.messages(),
    onMissingTarget: (d) => this.missingTarget.emit(d),
    onOpenChange: (open, details) => {
      let cancelled = false
      this.openChangeDetails.emit({
        open,
        details: {
          ...details,
          cancel: () => {
            cancelled = true
            details.cancel()
          },
        },
      })
      if (!cancelled) this.openChange.emit(open)
    },
    onStepChange: (stepId, details) => {
      let cancelled = false
      this.stepChangeDetails.emit({
        stepId,
        details: {
          ...details,
          cancel: () => {
            cancelled = true
            details.cancel()
          },
        },
      })
      if (!cancelled) this.stepIdChange.emit(stepId)
    },
  }))
  /** @internal The handle the parts use. */
  readonly handle = (): TourHandle => this.tour() ?? this.own
  /** @internal */
  readonly contentMounted = signal(false)
  /** @internal */
  readonly titleLevel = signal<HeadingLevel>(2)
  /** @internal */
  readonly rendered = signal<Rendered>({})
  /** @internal The stack's metadata for this tour's layer, followed while a step is shown. */
  readonly meta = injectLayerMeta(
    () => this.handle().view().state === "active",
    () => tourLayerId(this.handle().root),
  )

  /** @internal The tour's connect and the shown step. */
  api(extra: Extra = {}) {
    const tour = this.handle()
    const view = tour.view()
    const state = view.state as TourMachineState
    const context = view.context as TourContext
    const step = resolveStep(tour.props, context.patches, view.values.stepId as string) as
      | TourStepDef
      | undefined
    const centered = !step || context.targetMissing || !isAnchoredTourStep(step)
    return {
      state,
      step,
      api: tourConnect(
        {
          instance: tour.root,
          state,
          steps: tour.props.steps,
          step,
          targetMissing: context.targetMissing,
          modal: !!step && isStepModal(tour.props, step, centered),
          placement: context.placement,
          closeReason: context.closeReason,
          shownOnce: context.shownOnce,
          stepChanging: context.stepChanging,
          preventTargetInteraction: tour.props.preventTargetInteraction === true,
          rendered: this.rendered(),
          contentMounted: this.contentMounted(),
          meta: this.meta(),
          ...extra,
          messages: tour.messages,
        },
        tour.service().send,
      ),
    }
  }
}

/** Starts the tour: `<button rindTourTrigger>`. */
@Directive({ selector: "[rindTourTrigger]", exportAs: "rindTourTrigger" })
export class TourTrigger {
  constructor() {
    const root = injectTourRoot("Trigger")
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    const b = injectButton((m) => untracked(() => root.api()).api.pressTrigger(m))
    bindProps(() =>
      joinHandlers(
        root.api().api.trigger({
          focused: b.focused(),
          modality: b.modality(),
          pressed: b.press.pressed(),
          tag,
        }),
        b.press.props,
        b.handlers,
      ),
    )
  }
}

/** The tour's portal (`<ng-template rindTourPortal>`), with the trigger as its logical parent. */
@Directive({
  selector: "ng-template[rindTourPortal]",
  exportAs: "rindTourPortal",
  providers: PORTAL_PROVIDERS,
})
export class TourPortal extends PortalBase {
  private readonly owner = injectTourRoot("Portal")
  private readonly env = injectEnvironment()
  protected parent(): Element | null {
    return this.env.dom.getById(tourIds(this.owner.handle().root).trigger)
  }
}

/**
 * The geometry the machine writes on an element's style while it shows; React unmounts the
 * element after, here it stays hidden, so the geometry is removed once it is not mounted.
 */
function injectGeometryReset(el: Element, mounted: () => boolean, props: readonly string[]) {
  if (inject(PLATFORM_ID) !== "browser" || !(el instanceof HTMLElement)) return
  afterEveryRender({
    write: () => {
      if (untracked(mounted)) return
      for (const p of props) el.style.removeProperty(p)
    },
  })
}

/** Covers the page for the whole run (the same node between steps: no flash). */
@Directive({ selector: "[rindTourBackdrop]", exportAs: "rindTourBackdrop" })
export class TourBackdrop {
  constructor() {
    const root = injectTourRoot("Backdrop")
    const el: Element = inject(ElementRef).nativeElement
    // Mounted after hydration only: a `defaultOpen` tour renders nothing on the server.
    const hydrated = signal(false)
    if (inject(PLATFORM_ID) === "browser") afterNextRender(() => hydrated.set(true))
    const presence = injectPresence(() => root.api().api.open, el)
    injectGeometryReset(el, () => presence.mounted() && hydrated(), [
      "clip-path",
      "--rind-tour-viewport-width",
      "--rind-tour-viewport-height",
    ])
    bindProps(() =>
      presence.mounted() && hydrated()
        ? root.api().api.backdrop()
        : absentProps("tour", root.handle().root),
    )
  }
}

/** Highlights the step's target. */
@Directive({ selector: "[rindTourSpotlight]", exportAs: "rindTourSpotlight" })
export class TourSpotlight {
  constructor() {
    const root = injectTourRoot("Spotlight")
    const el: Element = inject(ElementRef).nativeElement
    const presence = injectPresence(() => {
      const { api, state } = root.api()
      return state === "active" && !api.centered
    }, el)
    injectGeometryReset(el, presence.mounted, [
      "--rind-tour-spotlight-x",
      "--rind-tour-spotlight-y",
      "--rind-tour-spotlight-width",
      "--rind-tour-spotlight-height",
      "--rind-tour-spotlight-radius",
    ])
    bindProps(() =>
      presence.mounted() ? root.api().api.spotlight() : absentProps("tour", root.handle().root),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The step change ends with the spotlight's own transition, or with the first scroll or
    // resize once nothing animates any more (the step's own scrollIntoView does not end it).
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      const changing = (root.handle().view().context as TourContext).stepChanging
      if (!ready() || !changing || !presence.mounted() || !(el instanceof HTMLElement)) return
      const settle = () => root.handle().service().send({ type: "SPOTLIGHT.SETTLED" })
      const view = el.ownerDocument.defaultView
      const onTransition = (e: Event) => {
        if (e.target === el) settle()
      }
      const onMove = () => {
        if (!el.getAnimations?.().length) settle()
      }
      el.addEventListener("transitionend", onTransition)
      el.addEventListener("transitioncancel", onTransition)
      view?.addEventListener("scroll", onMove, { capture: true, passive: true })
      view?.addEventListener("resize", onMove)
      onCleanup(() => {
        el.removeEventListener("transitionend", onTransition)
        el.removeEventListener("transitioncancel", onTransition)
        view?.removeEventListener("scroll", onMove, { capture: true })
        view?.removeEventListener("resize", onMove)
      })
    })
  }
}

/** Places the card against the target (or centres it). */
@Directive({ selector: "[rindTourPositioner]", exportAs: "rindTourPositioner" })
export class TourPositioner {
  constructor() {
    const root = injectTourRoot("Positioner")
    const el: Element = inject(ElementRef).nativeElement
    const env = injectEnvironment()
    const shown = () => root.handle().view().state === "active"
    // The target's direction: the portalled positioner carries it (inline sides, RTL).
    const dir = signal<"ltr" | "rtl" | undefined>(undefined)
    // It holds the content: it stays while the content's exit animations run.
    const presence = injectPresence(shown, el, { subtree: () => true })
    bindProps(() => {
      if (!presence.mounted()) return absentProps("tour", root.handle().root)
      const d = dir()
      return root.api(d ? { dir: d } : {}).api.positioner()
    })
    if (inject(PLATFORM_ID) !== "browser") return
    afterEveryRender(() => {
      if (!untracked(shown)) return
      const step = untracked(() => root.api().step)
      const anchor = step?.target?.() ?? env.dom.getById(tourIds(root.handle().root).trigger)
      const found = anchor?.closest("[dir]")?.getAttribute("dir")
      const next = found === "rtl" ? "rtl" : "ltr"
      if (untracked(dir) !== next) dir.set(next)
    })
  }
}

/** The step's card: `<div rindTourContent>`; headings inside are one level below its Title. */
@Directive({
  selector: "[rindTourContent]",
  exportAs: "rindTourContent",
  providers: [
    {
      provide: LAYER,
      useFactory: () => {
        const root = injectTourRoot("Content")
        return layerProvider(
          () => tourLayerId(root.handle().root),
          () => "tour",
        )
      },
    },
    {
      provide: HEADING_LEVEL,
      useFactory: () => {
        const root = injectTourRoot("Content")
        return computed(() => Math.min(6, root.titleLevel() + 1))
      },
    },
  ],
})
export class TourContent {
  constructor() {
    const root = injectTourRoot("Content")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focusWithin = signal(false)
    const contentFocused = signal(false)
    const modality = injectModality(env.modality, contentFocused)
    const shown = () => root.handle().view().state === "active"
    const presence = injectPresence(shown, el)
    let naming: { label?: string; labelledBy?: string; describedBy?: string } = {}
    const { statics } = bindProps(
      () => {
        if (!presence.mounted()) return absentProps("tour", root.handle().root)
        const { api } = root.api({
          focusWithin: focusWithin(),
          contentFocused: contentFocused(),
          modality: modality(),
        })
        const exiting = !shown() && presence.state() === "exiting"
        // Once closing, the card is inert.
        return { ...api.content(naming), ...(exiting ? { inert: "" } : {}) }
      },
      { owns: ["aria-describedby", "aria-label", "aria-labelledby"] },
    )
    const label = statics.get("aria-label")
    const labelledBy = statics.get("aria-labelledby")
    const describedBy = statics.get("aria-describedby")
    naming = {
      ...(label === undefined ? {} : { label }),
      ...(labelledBy === undefined ? {} : { labelledBy }),
      ...(describedBy === undefined ? {} : { describedBy }),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      const mounted = ready() && presence.mounted()
      untracked(() => {
        root.contentMounted.set(mounted)
        if (!mounted || !(el instanceof HTMLElement)) return
        onCleanup(() => root.contentMounted.set(false))
        // Focus within, from the DOM itself (native events plus a frame check).
        const sync = () => {
          const active = el.ownerDocument.activeElement
          focusWithin.set(active !== null && el.contains(active))
          contentFocused.set(active === el)
        }
        const onFocusOut = (e: FocusEvent) => {
          const next = e.relatedTarget as Node | null
          if (next && el.contains(next)) return
          focusWithin.set(false)
          contentFocused.set(false)
        }
        sync()
        const frame = env.scheduler.requestAnimationFrame(sync)
        el.addEventListener("focusin", sync)
        el.addEventListener("focusout", onFocusOut)
        onCleanup(() => {
          env.scheduler.cancelAnimationFrame(frame)
          el.removeEventListener("focusin", sync)
          el.removeEventListener("focusout", onFocusOut)
        })
      })
    })
  }
}

@Directive({ selector: "[rindTourArrow]", exportAs: "rindTourArrow" })
export class TourArrow {
  constructor() {
    const root = injectTourRoot("Arrow")
    bindProps(() => root.api().api.arrow())
  }
}

/** Registers a title/description part with the Root while it is rendered. */
function injectRegistered(root: TourRoot, part: "title" | "description") {
  if (inject(PLATFORM_ID) !== "browser") return
  const ready = signal(false)
  afterNextRender(() => ready.set(true))
  effect((onCleanup) => {
    if (!ready()) return
    const id = partId("tour", root.handle().root, part)
    untracked(() => root.rendered.set({ ...root.rendered(), [part]: id }))
    onCleanup(() => untracked(() => root.rendered.set({ ...root.rendered(), [part]: undefined })))
  })
}

/** The step's title: its content, or the shown step's `title` (`<h2 rindTourTitle>`). */
@Component({
  selector: "[rindTourTitle]",
  exportAs: "rindTourTitle",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class TourTitle {
  /** The heading level (default 2); headings in the card are one level below. */
  readonly level = input<HeadingLevel>(2)
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const root = injectTourRoot("Title")
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    injectRegistered(root, "title")
    this.text = () => root.api().step?.title ?? ""
    effect(() => {
      const level = this.level()
      untracked(() => root.titleLevel.set(level))
    })
    bindProps(() => root.api().api.title({ level: this.level(), tag }), { owns: ["level"] })
  }
}

/** The step's description: its content, or the shown step's `description`. */
@Component({
  selector: "[rindTourDescription]",
  exportAs: "rindTourDescription",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class TourDescription {
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const root = injectTourRoot("Description")
    injectRegistered(root, "description")
    this.text = () => root.api().step?.description ?? ""
    bindProps(() => root.api().api.description())
  }
}

/** "Step 2 of 4": its content, or the progress label. */
@Component({
  selector: "[rindTourProgressText]",
  exportAs: "rindTourProgressText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class TourProgressText {
  /** @internal */
  protected readonly text: () => string
  constructor() {
    const root = injectTourRoot("ProgressText")
    this.text = () => root.api().api.progressLabel()
    bindProps(() => root.api().api.progressText())
  }
}

/**
 * Renders its template with the shown step's actions:
 * `<ng-template rindTourActions let-actions>` (`@for (a of actions; …)`).
 */
@Directive({ selector: "ng-template[rindTourActions]", exportAs: "rindTourActions" })
export class TourActions {
  constructor() {
    const root = injectTourRoot("Actions")
    const template = inject(TemplateRef<{ $implicit: readonly TourAction<string>[] }>)
    const container = inject(ViewContainerRef)
    let view: EmbeddedViewRef<{ $implicit: readonly TourAction<string>[] }> | null = null
    effect(() => {
      // Sound: the steps are TourStepDef, whose actions carry text labels.
      const actions = root.api().api.actions as readonly TourAction<string>[]
      untracked(() => {
        if (view) {
          view.context.$implicit = actions
          view.markForCheck()
          return
        }
        view = container.createEmbeddedView(template, { $implicit: actions })
      })
    })
  }

  static ngTemplateContextGuard(
    _dir: TourActions,
    ctx: unknown,
  ): ctx is { $implicit: readonly TourAction<string>[] } {
    return true
  }
}

/** One action of the step (`next`, `prev`, `skip`, …): its content, or the action's label. */
@Component({
  selector: "[rindTourActionTrigger]",
  exportAs: "rindTourActionTrigger",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ action().label ?? '' }}</ng-content>",
})
export class TourActionTrigger {
  readonly action = input.required<TourAction<string>>()
  constructor() {
    const root = injectTourRoot("ActionTrigger")
    const el: Element = inject(ElementRef).nativeElement
    const b = injectButton(() =>
      untracked(() => root.api()).api.pressAction(untracked(this.action)),
    )
    // No content of its own (an icon): named by the action's message.
    const empty = signal(false)
    bindProps(
      () =>
        joinHandlers(
          {
            ...root.api().api.actionTrigger(this.action(), {
              focused: b.focused(),
              modality: b.modality(),
              pressed: b.press.pressed(),
              empty: empty() || (el.textContent ?? "").trim() === "",
            }),
            // Sound: an action's attributes are element attributes (strings), as a part's.
            ...(this.action().attrs as PartProps | undefined),
          },
          b.press.props,
          b.handlers,
        ),
      { owns: ["action"] },
    )
    if (inject(PLATFORM_ID) === "browser")
      afterEveryRender({ read: () => empty.set((el.textContent ?? "").trim() === "") })
  }
}

/** Ends the tour: `<button rindTourCloseTrigger>`; an empty one (an icon) is named "Close". */
@Directive({ selector: "[rindTourCloseTrigger]", exportAs: "rindTourCloseTrigger" })
export class TourCloseTrigger {
  constructor() {
    const root = injectTourRoot("CloseTrigger")
    const el: Element = inject(ElementRef).nativeElement
    const b = injectButton(() => untracked(() => root.api()).api.pressClose())
    const empty = signal(false)
    bindProps(() =>
      joinHandlers(
        root.api().api.closeTrigger({
          focused: b.focused(),
          modality: b.modality(),
          pressed: b.press.pressed(),
          empty: empty() || (el.textContent ?? "").trim() === "",
        }),
        b.press.props,
        b.handlers,
      ),
    )
    if (inject(PLATFORM_ID) === "browser")
      afterEveryRender({ read: () => empty.set((el.textContent ?? "").trim() === "") })
  }
}

/** The Tour's parts, for a standalone component's `imports`. */
export const Tour = [
  TourRoot,
  TourTrigger,
  TourPortal,
  TourBackdrop,
  TourSpotlight,
  TourPositioner,
  TourContent,
  TourArrow,
  TourTitle,
  TourDescription,
  TourProgressText,
  TourActions,
  TourActionTrigger,
  TourCloseTrigger,
] as const
