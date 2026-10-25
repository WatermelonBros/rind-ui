import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  type EmbeddedViewRef,
  effect,
  forwardRef,
  InjectionToken,
  Injector,
  inject,
  input,
  output,
  PLATFORM_ID,
  Renderer2,
  RendererStyleFlags2,
  type Signal,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
} from "@angular/core"
import {
  type MarqueeEvent,
  type MarqueeMessages,
  type MarqueeOrientation,
  type MarqueeState,
  type MessageOverrides,
  marqueeConnect,
  marqueeCopies,
  marqueeDuration,
  marqueeMachine,
  marqueeMessages,
  marqueeSpeed,
  mirror,
  observeMarquee,
  type PartProps,
  partId,
  retime,
  reveal,
  untabbable,
} from "@rind-ui/core"
import { bindProps, cssName, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectMessages } from "../provider"

declare const process: { env: { NODE_ENV?: string } }

/** The marquee's state, for the template (`#m="rindMarqueeRoot"`, `m.state()`). */
export interface MarqueeRenderState {
  readonly state: MarqueeState
  /** The user pause (a hover pause is `state` "paused" with this false). */
  readonly paused: boolean
  readonly orientation: MarqueeOrientation
  readonly reverse: boolean
}

const MARQUEE = new InjectionToken<MarqueeRoot>("rind-ui.marquee")

function injectMarquee(part: string): MarqueeRoot {
  const root = inject(MARQUEE, { optional: true })
  if (!root) throw new Error(`rindMarquee${part} must be inside rindMarqueeRoot`)
  return root
}

/**
 * Scrolling content: `<div rindMarqueeRoot role="region" aria-label="Partners">` with a
 * PauseTrigger and a Viewport holding `<div *rindMarqueeContent>` (stamped once per copy).
 */
@Directive({
  selector: "[rindMarqueeRoot]",
  exportAs: "rindMarqueeRoot",
  providers: [{ provide: MARQUEE, useExisting: forwardRef(() => MarqueeRoot) }],
})
export class MarqueeRoot {
  /** Controlled user pause (`[(paused)]`). */
  readonly paused = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** Uncontrolled initial user pause. */
  readonly defaultPaused = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })
  /** A mouse or pen over the Viewport pauses until it leaves (never touch). Default true. */
  readonly pauseOnHover = input(true, { transform: booleanAttribute })
  /** CSS px per second (default 50); below 1 counts as 1. */
  readonly speed = input<number>()
  readonly orientation = input<MarqueeOrientation>("horizontal")
  /** Moves toward the inline end (or down). */
  readonly reverse = input(false, { transform: booleanAttribute })
  /** Enough copies to fill the Viewport (at most 32). */
  readonly autoFill = input(false, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<MarqueeMessages>>()
  readonly id = input<string>()
  /** `details.reason`: "trigger" or "focus"; `details.cancel()` refuses it. */
  readonly pausedChangeDetails = output<ChangeEvent<boolean, MarqueeEvent>>()
  /** The accepted pause, for `[(paused)]`. */
  readonly pausedChange = output<boolean>()

  private readonly emit = changeEmitter<boolean, MarqueeEvent>(
    this.pausedChangeDetails,
    this.pausedChange,
  )
  /** @internal */
  readonly api: Signal<ReturnType<typeof marqueeConnect>>
  /** @internal */
  readonly send: (event: MarqueeEvent) => void
  /** @internal */
  readonly copies: Signal<number>
  readonly state: Signal<MarqueeRenderState>

  constructor() {
    const env = injectEnvironment()
    const instance = injectRootId(() => this.id())
    const messages = injectMessages("marquee", marqueeMessages, () => this.messages())
    const { view, send } = injectMachine(
      marqueeMachine,
      () => ({
        paused: this.paused(),
        defaultPaused: this.defaultPaused(),
        onPausedChange: this.emit,
        pauseOnHover: this.pauseOnHover(),
      }),
      {},
    )
    this.send = send
    this.api = computed(() =>
      marqueeConnect({
        instance: instance(),
        state: view().state as MarqueeState,
        paused: view().values.paused,
        orientation: this.orientation(),
        reverse: this.reverse(),
        autoFill: this.autoFill(),
        duration: marqueeDuration(view().context.size, this.speed()),
        ids: { viewport: partId("marquee", instance(), "viewport") },
        messages: messages(),
      }),
    )
    this.state = computed(() => ({
      state: view().state as MarqueeState,
      paused: view().values.paused,
      orientation: this.orientation(),
      reverse: this.reverse(),
    }))
    this.copies = computed(() =>
      marqueeCopies(view().state as MarqueeState, view().context.size, this.autoFill()),
    )
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "autofill",
          "defaultpaused",
          "id",
          "messages",
          "orientation",
          "paused",
          "pauseonhover",
          "reverse",
          "speed",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    // Read after hydration, then followed: the server and the first client render agree.
    afterNextRender(() => {
      send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
      destroy.onDestroy(
        env.motion.subscribeReducedMotion((reduced) => send({ type: "MOTION.CHANGED", reduced })),
      )
    })
    effect(() => {
      const speed = this.speed()
      if (process.env.NODE_ENV === "production" || speed === undefined) return
      if (marqueeSpeed(speed) !== speed)
        console.warn(`[rind-ui] marquee: speed ${speed} is below 1 or not finite; using 1`)
    })
  }
}

/** Pauses and resumes the motion: `<button rindMarqueePauseTrigger>`. */
@Directive({ selector: "[rindMarqueePauseTrigger]", exportAs: "rindMarqueePauseTrigger" })
export class MarqueePauseTrigger {
  constructor() {
    const root = injectMarquee("PauseTrigger")
    const env = injectEnvironment()
    // Tracking from the first render, so the press that focuses it is known as a pointer one.
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    }
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    bindProps(() =>
      joinHandlers(root.api().pauseTrigger({ focused: focused(), modality: modality() }), {
        onClick: () => root.send({ type: "TRIGGER.PRESS", modality: env.modality.modality() }),
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      }),
    )
  }
}

const copiesIn = (viewport: HTMLElement) =>
  Array.from(viewport.querySelectorAll<HTMLElement>(':scope > [data-part="content"]'))

/** The clipping window the copies move in; a hover or focus inside pauses. */
@Directive({ selector: "[rindMarqueeViewport]", exportAs: "rindMarqueeViewport" })
export class MarqueeViewport {
  constructor() {
    const root = injectMarquee("Viewport")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    // A value, not the state: a measurement changes the state, never the axis.
    const axis = computed(() => (root.orientation() === "horizontal" ? "x" : "y"))
    const duration = () => {
      const style = root.api().viewport()["style"] as Record<string, string> | undefined
      return Number.parseFloat(style?.["--rind-marquee-duration"] ?? "") * 1000
    }
    bindProps(() =>
      joinHandlers(root.api().viewport(), {
        onPointerEnter: (e: PointerEvent) => {
          if (e.pointerType !== "touch") root.send({ type: "POINTER.ENTER" })
        },
        onPointerLeave: (e: PointerEvent) => {
          if (e.pointerType !== "touch") root.send({ type: "POINTER.LEAVE" })
        },
        onFocusIn: (e: FocusEvent) => {
          const modality = env.modality.modality()
          root.send({ type: "FOCUS.ENTER", modality })
          if (modality !== "keyboard" && modality !== "virtual") return
          const viewport = e.currentTarget
          if (!(viewport instanceof HTMLElement) || !(e.target instanceof Element)) return
          reveal(e.target, viewport, copiesIn(viewport), {
            axis: axis(),
            dir: getComputedStyle(viewport).direction === "rtl" ? "rtl" : "ltr",
            reversed: root.state().reverse,
            durationMs: duration(),
          })
        },
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    // Measure the viewport and the original copy, once per frame on change.
    effect((onCleanup) => {
      const a = axis()
      if (!ready()) return
      const first = el.querySelector<HTMLElement>(':scope > [data-part="content"]')
      if (!(el instanceof HTMLElement) || !first) return
      onCleanup(
        untracked(() =>
          observeMarquee(el, first, a, env.scheduler, (size) =>
            root.send({ type: "MEASURED", ...size }),
          ),
        ),
      )
    })
    // Before the render writes them: a new duration keeps the progress, a new direction keeps
    // the position.
    let prev: readonly [number, boolean] | undefined
    effect(() => {
      const now = [duration(), root.state().reverse] as const
      const before = prev
      prev = now
      if (!before || !(el instanceof HTMLElement)) return
      // Object.is: an unmeasured duration is NaN, the same NaN on every run.
      if (Object.is(before[0], now[0]) && before[1] === now[1]) return
      untracked(() => {
        const copies = copiesIn(el)
        if (!Object.is(before[0], now[0])) retime(copies, before[0], now[0])
        if (before[1] !== now[1]) mirror(copies, now[0])
      })
    })
  }
}

/**
 * Writes a part's attributes and styles on an element a structural directive stamped; only
 * what changed (a write is a mutation the marquee's measuring observes).
 */
function stampedWriter(renderer: Renderer2, el: Element) {
  let attrs = new Map<string, string>()
  let styles = new Map<string, string>()
  return (props: PartProps) => {
    const nextAttrs = new Map<string, string>()
    const nextStyles = new Map<string, string>()
    for (const [key, value] of Object.entries(props)) {
      if (key === "style" && value && typeof value === "object") {
        for (const [k, v] of Object.entries(value as Record<string, unknown>))
          if (v !== undefined && v !== null) nextStyles.set(cssName(k), String(v))
      } else if (value !== undefined && value !== null && value !== false) {
        nextAttrs.set(key, value === true ? "" : String(value))
      }
    }
    for (const key of attrs.keys()) if (!nextAttrs.has(key)) renderer.removeAttribute(el, key)
    for (const [key, value] of nextAttrs)
      if (attrs.get(key) !== value) renderer.setAttribute(el, key, value)
    for (const key of styles.keys())
      if (!nextStyles.has(key)) renderer.removeStyle(el, key, RendererStyleFlags2.DashCase)
    for (const [key, value] of nextStyles)
      if (styles.get(key) !== value) renderer.setStyle(el, key, value, RendererStyleFlags2.DashCase)
    attrs = nextAttrs
    styles = nextStyles
  }
}

/**
 * The moving content, stamped once per copy: `<div *rindMarqueeContent>…</div>`. The copies
 * repeat the template (live, as its content changes), hidden from assistive technology and
 * out of the tab order; your `id` stays on the original only.
 */
@Directive({ selector: "[rindMarqueeContent]", exportAs: "rindMarqueeContent" })
export class MarqueeContent {
  constructor() {
    const root = injectMarquee("Content")
    const template = inject(TemplateRef<unknown>)
    const container = inject(ViewContainerRef)
    const renderer = inject(Renderer2)
    const browser = inject(PLATFORM_ID) === "browser"
    const injector = inject(Injector)
    const stamped: {
      view: EmbeddedViewRef<unknown>
      write: (p: PartProps) => void
      release: () => void
    }[] = []
    const stamp = (index: number) => {
      const view = container.createEmbeddedView(template, { $implicit: index, index })
      const el = view.rootNodes.find((n): n is Element => n instanceof Element)
      if (!el) throw new Error("rindMarqueeContent must be on an element")
      // The consumer's id stays on the original only.
      if (index > 0) el.removeAttribute("id")
      const release = index > 0 && browser && el instanceof HTMLElement ? untabbable(el) : () => {}
      stamped.push({ view, write: stampedWriter(renderer, el), release })
      if (index === 0 && browser && process.env.NODE_ENV !== "production") {
        afterNextRender(
          () => {
            if (el.querySelector("[id]"))
              console.warn(
                "[rind-ui] marquee: an element with an id is in the Content; copies repeat it",
              )
          },
          { injector },
        )
      }
    }
    effect(() => {
      const count = Math.max(1, root.copies())
      const api = root.api()
      untracked(() => {
        while (stamped.length < count) stamp(stamped.length)
        while (stamped.length > count) {
          const last = stamped.pop()
          last?.release()
          last?.view.destroy()
        }
        for (const [i, s] of stamped.entries()) s.write(api.content(i))
      })
    })
    inject(DestroyRef).onDestroy(() => {
      for (const s of stamped) s.release()
    })
  }
}

/** The Marquee's parts, for a standalone component's `imports`. */
export const Marquee = [MarqueeRoot, MarqueePauseTrigger, MarqueeViewport, MarqueeContent] as const
