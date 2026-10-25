import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
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
} from "@angular/core"
import {
  type ChangeDetails,
  type ClosedContent,
  type CollapsibleEvent,
  type CollapsiblePart,
  type PartProps as CorePartProps,
  collapsibleConnect,
  collapsibleMachine,
  contentSize,
  focusSafely,
  type Modality,
  partId,
  untilFound,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { HEADING_LEVEL } from "../heading/heading"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"

declare const process: { env: { NODE_ENV?: string } }

/**
 * What an embedding component (an Accordion item) adds to the Trigger, Content and Indicator:
 * its connect output, merged over the Collapsible's.
 */
export interface CollapsibleDecoration {
  readonly trigger?: () => CorePartProps
  /** `triggerId`: the trigger's rendered id (a consumer id included). */
  readonly content?: (triggerId: string) => CorePartProps
  readonly indicator?: () => CorePartProps
  /** The heading level inside the content (an Accordion's deeper level). */
  readonly contentLevel?: () => number
}

type Service = ReturnType<typeof injectMachine<typeof collapsibleMachine>>

/** The context the Collapsible parts read; an Accordion item provides its own. */
export interface CollapsibleCtx {
  /** `data-scope` and the size-variable prefix (`--rind-<scope>-content-*`). */
  readonly scope: string
  /** `data-instance`. */
  readonly instance: () => string
  /** The base of the part ids (one per disclosure; an accordion item has its own). */
  readonly idBase: () => string
  readonly decoration: CollapsibleDecoration
  readonly view: Service["view"]
  readonly send: Service["send"]
  readonly registry: () => PartRegistry<CollapsiblePart>
  readonly disabled: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly closedContent: () => ClosedContent
  readonly triggerEl: { value: Element | null }
  /** The consumer's trigger id, so a Content rendered after it labels itself with it. */
  readonly triggerId: { current: string | undefined }
  readonly contentEl: { value: Element | null }
}

/** The disclosure a part belongs to: a Collapsible Root, or an Accordion item. */
export const COLLAPSIBLE = new InjectionToken<CollapsibleCtx>("rind-ui.collapsible")

function injectCollapsible(part: string): CollapsibleCtx {
  const ctx = inject(COLLAPSIBLE, { optional: true })
  if (!ctx) {
    throw new Error(
      `rindCollapsible${part} must be inside rindCollapsibleRoot (or rindAccordionItem)`,
    )
  }
  return ctx
}

export interface CollapsibleServiceOptions {
  readonly scope: string
  readonly instance: () => string
  readonly idBase: () => string
  readonly decoration: CollapsibleDecoration
  readonly props: () => {
    readonly open: boolean | undefined
    readonly defaultOpen: boolean | undefined
    readonly onOpenChange:
      | ((open: boolean, details: ChangeDetails<CollapsibleEvent>) => void)
      | undefined
    readonly disabled: boolean
    readonly focusableWhenDisabled: boolean
    readonly closedContent: ClosedContent
  }
}

/** One disclosure's service and context (a Collapsible Root, or an Accordion item). */
export function injectCollapsibleService(o: CollapsibleServiceOptions): CollapsibleCtx {
  const env = injectEnvironment()
  const triggerEl: { value: Element | null } = { value: null }
  const contentEl: { value: Element | null } = { value: null }
  const registry = injectPartRegistry<CollapsiblePart>(() => ({
    scope: o.scope,
    root: o.idBase(),
    // Kept-mounted content is rendered on the server too: aria-controls is in the HTML.
    ...(o.props().closedContent !== "unmount" ? { expected: ["content"] as const } : {}),
  }))
  const { view, send } = injectMachine(collapsibleMachine, () => ({
    open: o.props().open,
    defaultOpen: o.props().defaultOpen,
    onOpenChange: o.props().onOpenChange,
    disabled: o.props().disabled,
    // Closing with focus inside: the trigger, keeping the modality, before hiding.
    focusOutOfContent: () => {
      const content = contentEl.value
      const trigger = triggerEl.value
      const active = content?.ownerDocument.activeElement
      if (content && trigger instanceof HTMLElement && active && content.contains(active)) {
        void focusSafely(trigger, env, "programmatic")
      }
    },
  }))
  return {
    scope: o.scope,
    instance: o.instance,
    idBase: o.idBase,
    decoration: o.decoration,
    view,
    send,
    registry,
    disabled: () => o.props().disabled,
    focusableWhenDisabled: () => o.props().focusableWhenDisabled,
    closedContent: () => o.props().closedContent,
    triggerEl,
    triggerId: { current: undefined },
    contentEl,
  }
}

const NO_DECORATION: CollapsibleDecoration = {}

export interface CollapsibleState {
  readonly open: boolean
  readonly disabled: boolean
}

/** The connect output for a part, with that part's interaction state. Call it in a constructor. */
function injectApi(ctx: CollapsibleCtx) {
  const env = injectEnvironment()
  const content = injectRenderedId(ctx.registry, "content")
  const trigger = injectRenderedId(ctx.registry, "trigger")
  return (
    s: {
      triggerFocused?: boolean
      modality?: Modality
      pressed?: boolean
      hovered?: boolean
      triggerTag?: string
    } = {},
  ) => {
    const triggerId = trigger() ?? ctx.triggerId.current
    return collapsibleConnect(
      {
        scope: ctx.scope,
        instance: ctx.instance(),
        open: ctx.view().matches("open"),
        reveal: ctx.view().context.reveal,
        disabled: ctx.disabled(),
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        closedContent: ctx.closedContent(),
        triggerTag: s.triggerTag ?? "button",
        triggerFocused: s.triggerFocused ?? false,
        modality: s.modality ?? "keyboard",
        pressed: s.pressed ?? false,
        hovered: s.hovered ?? false,
        triggerId: triggerId ?? partId(ctx.scope, ctx.idBase(), "trigger"),
        contentId: content() ?? partId(ctx.scope, ctx.idBase(), "content"),
        contentRendered: content() !== undefined,
      },
      env,
    )
  }
}

/** `undefined` stays undefined (uncontrolled); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A disclosure: `<div rindCollapsibleRoot [(open)]="shown">` with a Trigger and the Content it
 * shows and hides (findable by the browser's search while closed, by default).
 */
@Directive({
  selector: "[rindCollapsibleRoot]",
  exportAs: "rindCollapsibleRoot",
  providers: [
    { provide: COLLAPSIBLE, useFactory: () => inject(forwardRef(() => CollapsibleRoot)).ctx },
  ],
})
export class CollapsibleRoot {
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Ignores activation; the content stays as it is (a parent can still open or close it). */
  readonly disabled = input(false, { transform: booleanAttribute })
  readonly focusableWhenDisabled = input(false, { transform: booleanAttribute })
  /** What closed content becomes: findable by the browser's search (default), hidden, or removed. */
  readonly closedContent = input<ClosedContent>("until-found")
  readonly id = input<string>()
  /** Every activation proposes a value; `details.cancel()` vetoes it. */
  readonly openChangeDetails = output<ChangeEvent<boolean, CollapsibleEvent>>()
  /** The accepted value, for `[(open)]`. */
  readonly openChange = output<boolean>()

  private readonly emit = changeEmitter<boolean, CollapsibleEvent>(
    this.openChangeDetails,
    this.openChange,
  )
  /** @internal */
  readonly ctx: CollapsibleCtx
  /** The disclosure's state, for the template (`#c="rindCollapsibleRoot"`, `c.state()`). */
  readonly state: Signal<CollapsibleState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const ctx = injectCollapsibleService({
      scope: "collapsible",
      instance,
      idBase: instance,
      decoration: NO_DECORATION,
      props: () => ({
        open: this.open(),
        defaultOpen: this.defaultOpen(),
        onOpenChange: this.emit,
        disabled: this.disabled(),
        focusableWhenDisabled: this.focusableWhenDisabled(),
        closedContent: this.closedContent(),
      }),
    })
    this.ctx = ctx
    this.state = computed(() => ({ open: ctx.view().matches("open"), disabled: ctx.disabled() }))
    const apiFor = injectApi(ctx)
    bindProps(
      () => ({ ...apiFor().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: ["closedcontent", "defaultopen", "disabled", "focusablewhendisabled", "id", "open"],
      },
    )
  }
}

/** Shows and hides the Content: `<button rindCollapsibleTrigger>`. */
@Directive({
  selector: "[rindCollapsibleTrigger], [rindAccordionTrigger]",
  exportAs: "rindCollapsibleTrigger",
})
export class CollapsibleTrigger {
  readonly id = input<string>()
  constructor() {
    const ctx = injectCollapsible("Trigger")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    ctx.triggerEl.value = el
    // A consumer id is the id the content's aria-labelledby references (an Accordion region).
    const ownId = () => this.id() ?? partId(ctx.scope, ctx.idBase(), "trigger")
    injectRegisterPart(ctx.registry, "trigger", ownId)
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const press = injectPress({
      env,
      disabled: () => ctx.disabled(),
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "TOGGLE", modality: e.modality })
      },
    })
    const hover = injectHover({ env, send: () => {}, disabled: () => ctx.disabled() })
    const apiFor = injectApi(ctx)
    bindProps(
      () => {
        ctx.triggerId.current = this.id()
        const api = apiFor({
          triggerFocused: focused(),
          modality: modality(),
          pressed: press.pressed(),
          hovered: hover.hovered(),
          triggerTag: tag,
        })
        return joinHandlers(
          { ...api.trigger(), ...ctx.decoration.trigger?.(), id: ownId() },
          press.props,
          hover.props,
          { onFocusIn: () => focused.set(true), onFocusOut: () => focused.set(false) },
        )
      },
      { owns: ["id"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The modality tracker must see the pointerdown that comes before focus.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/**
 * What the Trigger shows and hides: `<div rindCollapsibleContent>`. Closed, it is hidden
 * (`hidden="until-found"` by default, so find-in-page reveals it); `closedContent="unmount"`
 * hides it completely (React removes it).
 */
@Directive({
  selector: "[rindCollapsibleContent], [rindAccordionContent]",
  exportAs: "rindCollapsibleContent",
  providers: [
    {
      provide: HEADING_LEVEL,
      useFactory: () => inject(forwardRef(() => CollapsibleContent)).level,
    },
  ],
})
export class CollapsibleContent {
  readonly id = input<string>()
  /** @internal The heading level inside (an Accordion's deeper one), or the one around it. */
  readonly level: Signal<number | undefined>

  constructor() {
    const ctx = injectCollapsible("Content")
    const env = injectEnvironment()
    const around = inject(HEADING_LEVEL, { optional: true, skipSelf: true })
    this.level = computed(() => ctx.decoration.contentLevel?.() ?? around?.())
    const el: Element = inject(ElementRef).nativeElement
    ctx.contentEl.value = el
    const open = () => ctx.view().matches("open")
    const presence = injectPresence(open, el)
    // Closed with nothing animating (reduced motion, jsdom, no theme): hidden in the closing
    // step itself, not after presence's asynchronous wait (base-ui#4553).
    const quickExit = signal(false)
    effect(() => {
      if (open()) quickExit.set(false)
    })
    const exited = () => presence.state() === "absent" || quickExit()
    const mounted = () => ctx.closedContent() !== "unmount" || open() || !exited()
    // A consumer id is the id the trigger references (aria-controls).
    const own = () => this.id() ?? partId(ctx.scope, ctx.idBase(), "content")
    injectRegisterPart(ctx.registry, "content", () => (mounted() ? own() : undefined))
    const findable = () => ctx.closedContent() === "until-found" && !ctx.disabled()
    // Defined from the first paint, the server's included (zag#1396); the same value on every
    // render, so the binder never overwrites the imperative writes below. Read on the first
    // render: the machine reads the inputs, which are set after this constructor.
    let initialSize: string | undefined
    const apiFor = injectApi(ctx)
    const triggerRendered = injectRenderedId(ctx.registry, "trigger")
    bindProps(
      () => {
        if (!mounted()) return absentProps(ctx.scope, ctx.instance())
        const triggerId =
          triggerRendered() ?? ctx.triggerId.current ?? partId(ctx.scope, ctx.idBase(), "trigger")
        // Closed and settled: hidden. until-found is a boolean `hidden` (server HTML carries
        // hidden=""), upgraded right after the first render by the until-found module.
        const hidden = !open() && exited()
        initialSize ??= open() ? "auto" : "0px"
        return {
          ...apiFor().content(hidden),
          ...ctx.decoration.content?.(triggerId),
          style: {
            [`--rind-${ctx.scope}-content-height`]: initialSize,
            [`--rind-${ctx.scope}-content-width`]: initialSize,
          },
        }
      },
      { owns: ["id"] },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    let size: ReturnType<typeof contentSize> | null = null
    // The open value of the last render that ran the size sequence (undefined: none yet).
    let sized: boolean | undefined
    let stopAnimation = () => {}
    // Size properties: 0px → px → auto → px → 0px, only after a render that changed `open`.
    const runSize = () => {
      const isOpen = open()
      const initial = sized === undefined
      if (sized === isOpen) return
      sized = isOpen
      if (!(el instanceof HTMLElement)) return
      size ??= contentSize(el, `rind-${ctx.scope}`)
      const s = size
      stopAnimation()
      stopAnimation = () => {}
      if (isOpen) {
        const instant = initial || ctx.view().context.reveal === "find-in-page"
        s.opened({ instant })
        if (instant) return
        // Settled once the enter animations finished (or at once when nothing animates).
        const running = el.getAnimations?.({ subtree: true }) ?? []
        let live = true
        void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
          if (live) s.settled()
        })
        stopAnimation = () => {
          live = false
        }
        return
      }
      if (initial) return
      s.closed()
      if ((el.getAnimations?.({ subtree: true }) ?? []).length === 0) quickExit.set(true)
    }
    // until-found: imperatively, re-applied after every render; beforematch opens instantly.
    let finder: ReturnType<typeof untilFound> | null = null
    const runFinder = () => {
      const want = findable() && el instanceof HTMLElement
      if (finder && !want) {
        finder.dispose()
        // No longer findable (disabled): the binder's `hidden` did not change, so degrade it.
        if (el.getAttribute("hidden") === "until-found") el.setAttribute("hidden", "")
        finder = null
      }
      if (want && !finder && el instanceof HTMLElement) {
        finder = untilFound(el, {
          scheduler: env.scheduler,
          isOpen: () => open() || !exited(),
          onReveal: () => {
            ctx.send({ type: "OPEN", reason: "find-in-page" })
            // Full size in the same task, before the browser highlights the match (base-ui#5513).
            size?.opened({ instant: true })
          },
        })
      }
      finder?.sync()
      // Development: a stylesheet hiding [hidden] defeats find-in-page (react-spectrum#7160).
      if (
        process.env.NODE_ENV === "production" ||
        !(el instanceof HTMLElement) ||
        !findable() ||
        open()
      )
        return
      if (el.getAttribute("hidden") === "until-found" && getComputedStyle(el).display === "none") {
        console.warn(
          `[rind-ui] ${ctx.scope}: the closed content computes display: none, so find-in-page cannot reveal it (a stylesheet sets [hidden] { display: none }?)`,
        )
      }
    }
    afterEveryRender(() => {
      runSize()
      runFinder()
    })
    inject(DestroyRef).onDestroy(() => {
      stopAnimation()
      finder?.dispose()
    })
  }
}

/** Follows the open state (`data-state`): a chevron that turns. */
@Directive({
  selector: "[rindCollapsibleIndicator], [rindAccordionIndicator]",
  exportAs: "rindCollapsibleIndicator",
})
export class CollapsibleIndicator {
  constructor() {
    const ctx = injectCollapsible("Indicator")
    const apiFor = injectApi(ctx)
    bindProps(() => ({ ...apiFor().indicator(), ...ctx.decoration.indicator?.() }))
  }
}

/** The Collapsible's parts, for a standalone component's `imports`. */
export const Collapsible = [
  CollapsibleRoot,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleIndicator,
] as const
