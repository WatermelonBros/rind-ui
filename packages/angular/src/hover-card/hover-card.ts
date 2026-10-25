import {
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
  isDevMode,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  domHoverIntent,
  domPositioning,
  focusEvent,
  type HoverCardChangeDetails,
  type HoverCardProps,
  type HoverIntent,
  hoverCardConnect,
  hoverCardLayerId,
  hoverCardMachine,
  hoverCardPositioning,
  type LayerMeta,
  type PositioningProps,
  type Service,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality } from "../inject-press"
import {
  injectLayerMeta,
  injectParentLayer,
  injectRendered,
  LAYER,
  layerProvider,
} from "../layer-context"
import { PORTAL_PROVIDERS, PortalBase } from "../portal"
import { injectEnvironment, withCapabilities } from "../provider"

const HOVER_CARD = new InjectionToken<HoverCardRoot>("rind-ui.hover-card")

function injectHoverCard(part: string): HoverCardRoot {
  const root = inject(HOVER_CARD, { optional: true })
  if (!root) throw new Error(`rindHoverCard${part} must be inside rindHoverCardRoot`)
  return root
}

/** What an `openChangeDetails` output emits: the proposed visibility and why it changes. */
export interface HoverCardChangeEvent {
  readonly value: boolean
  /** `details.cancel()`, called synchronously, vetoes the change. */
  readonly details: HoverCardChangeDetails
}

export interface HoverCardState {
  readonly open: boolean
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/**
 * A link's preview, shown on hover and focus: `<ng-container rindHoverCardRoot>` with a
 * Trigger (`<a href>`) and, usually in `<ng-template rindHoverCardPortal>`, a Positioner
 * holding the Content.
 */
@Directive({
  selector: "[rindHoverCardRoot]",
  exportAs: "rindHoverCardRoot",
  providers: [{ provide: HOVER_CARD, useExisting: forwardRef(() => HoverCardRoot) }],
})
export class HoverCardRoot {
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default 700 ms. */
  readonly openDelay = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Default 300 ms. */
  readonly closeDelay = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly positioning = input<PositioningProps>()
  /** Base for the ids of the hover card's parts. Default: generated. */
  readonly id = input<string>()
  /** Positioner and content stay rendered (hidden) while closed. */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  readonly openChangeDetails = output<HoverCardChangeEvent>()
  /** The accepted visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()

  /** @internal */
  readonly root: () => string
  /** @internal */
  readonly view: ReturnType<typeof injectMachine<typeof hoverCardMachine>>["view"]
  /** @internal */
  readonly send: Service<typeof hoverCardMachine>["send"]
  /** @internal */
  readonly props: () => HoverCardProps
  /** @internal */
  readonly hoverIntent: HoverIntent
  /** @internal */
  readonly trigger = signal<HTMLElement | null>(null)
  /** @internal */
  readonly contentMounted = signal(false)
  /** @internal The stack's metadata for this layer, followed while shown. */
  readonly meta: Signal<LayerMeta | undefined>
  /** @internal */
  readonly isOpen: () => boolean
  /** The hover card's state, for the template (`#h="rindHoverCardRoot"`, `h.state()`). */
  readonly state: Signal<HoverCardState>

  constructor() {
    const root = injectRootId(() => this.id())
    this.root = root
    const parent = injectParentLayer()
    const env = injectEnvironment()
    const hoverEnv = withCapabilities(env, {
      position: domPositioning(env),
      hoverIntent: domHoverIntent(env),
    })
    this.hoverIntent = hoverEnv.hoverIntent
    // As changeEmitter, for the hover card's own details type (its reasons are the card's).
    const onOpenChange = (value: boolean, d: HoverCardChangeDetails) => {
      let cancelled = false
      this.openChangeDetails.emit({
        value,
        details: {
          ...d,
          cancel() {
            cancelled = true
            d.cancel()
          },
        },
      })
      if (!cancelled) this.openChange.emit(value)
    }
    this.props = (): HoverCardProps => ({
      open: this.open(),
      defaultOpen: this.defaultOpen(),
      onOpenChange,
      openDelay: this.openDelay(),
      closeDelay: this.closeDelay(),
      disabled: this.disabled(),
      positioning: this.positioning(),
      root: root(),
      parent: parent(),
      getTrigger: () => untracked(this.trigger),
    })
    const { view, send } = injectMachine(hoverCardMachine, this.props, hoverEnv)
    this.view = view
    this.send = send
    this.isOpen = () => view().values.open === true
    this.state = computed(() => ({ open: view().values.open === true }))
    this.meta = injectLayerMeta(this.isOpen, () => hoverCardLayerId(root()))
  }

  /** @internal */
  api(extra: { dir?: "ltr" | "rtl"; focusWithin?: boolean } = {}) {
    const view = this.view()
    return hoverCardConnect(
      {
        instance: this.root(),
        open: view.values.open === true,
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        contentMounted: this.contentMounted(),
        meta: this.meta(),
        manual: hoverCardPositioning(this.props()).mode === "manual",
        ...extra,
      },
      this.send,
    )
  }

  /** Opens it. */
  show(): void {
    this.send({ type: "OPEN" })
  }
  /** Closes it. */
  hide(): void {
    this.send({ type: "CLOSE" })
  }
}

/** The link that previews: `<a rindHoverCardTrigger href>`. It keeps its role and href. */
@Directive({ selector: "[rindHoverCardTrigger]", exportAs: "rindHoverCardTrigger" })
export class HoverCardTrigger {
  constructor() {
    const root = injectHoverCard("Trigger")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focused = signal(false)
    const hovered = signal(false)
    const modality = injectModality(env.modality, focused)
    const hover = root.hoverIntent.triggerProps((e) => root.send(e))
    const api = () => untracked(() => root.api())
    bindProps(() =>
      joinHandlers(
        root.api().trigger({ focused: focused(), hovered: hovered(), modality: modality() }, hover),
        {
          onPointerMove: (e: PointerEvent) => {
            if (e.pointerType === "mouse" || e.pointerType === "pen") hovered.set(true)
          },
          onPointerLeave: () => hovered.set(false),
          onFocus: (e: FocusEvent) => {
            focused.set(true)
            const f = focusEvent(e.currentTarget as Element, env.modality)
            api().focus(f.modality, f.cause)
          },
          onBlur: () => {
            focused.set(false)
            api().blur()
          },
        },
      ),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    root.trigger.set(el instanceof HTMLElement ? el : null)
    const destroy = inject(DestroyRef)
    // The modality tracker needs a subscriber while the trigger is rendered.
    afterNextRender(() => {
      destroy.onDestroy(env.modality.subscribe(() => {}))
      // Development: a hover card is a link's preview; a button wants a Popover.
      if (!isDevMode() || el.hasAttribute("href")) return
      console.warn(
        `[rind-ui] hover-card #${el.id}: the trigger is not a link (no href); a hover card is a link's preview — use a Popover for a button`,
      )
    })
    destroy.onDestroy(() => {
      if (untracked(root.trigger) === el) root.trigger.set(null)
    })
  }
}

/** Places the content against the trigger: `<div rindHoverCardPositioner>`. */
@Directive({ selector: "[rindHoverCardPositioner]", exportAs: "rindHoverCardPositioner" })
export class HoverCardPositioner {
  constructor() {
    const root = injectHoverCard("Positioner")
    const el: Element = inject(ElementRef).nativeElement
    // The trigger's direction: the portalled positioner carries it (inline sides, RTL).
    const dir = signal<"ltr" | "rtl" | undefined>(undefined)
    const ready = injectRendered()
    effect(() => {
      if (!ready() || !root.isOpen()) return
      const found = root.trigger()?.closest("[dir]")?.getAttribute("dir")
      dir.set(found === "rtl" ? "rtl" : "ltr")
    })
    // It holds the content: it stays while the content's exit animations run.
    const presence = injectPresence(() => root.isOpen(), el, {
      keepMounted: () => root.keepMounted(),
      subtree: () => true,
    })
    bindProps(() => {
      if (!presence.mounted()) return absentProps("hover-card", root.root())
      const d = dir()
      return {
        ...root.api(d ? { dir: d } : {}).positioner(),
        hidden: !root.isOpen() && root.keepMounted(),
      }
    })
  }
}

/** The card: `<div rindHoverCardContent>`. Layers opened from it are its children. */
@Directive({
  selector: "[rindHoverCardContent]",
  exportAs: "rindHoverCardContent",
  providers: [
    {
      provide: LAYER,
      useFactory: () => {
        const root = injectHoverCard("Content")
        return layerProvider(
          () => hoverCardLayerId(root.root()),
          () => "popover",
        )
      },
    },
  ],
})
export class HoverCardContent {
  constructor() {
    const root = injectHoverCard("Content")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focusWithin = signal(false)
    const presence = injectPresence(() => root.isOpen(), el, {
      keepMounted: () => root.keepMounted(),
    })
    let naming: { label?: string; labelledBy?: string } = {}
    const { statics } = bindProps(
      () => {
        if (!presence.mounted()) return absentProps("hover-card", root.root())
        const open = root.isOpen()
        const exiting = !open && presence.state() === "exiting"
        return {
          ...root.api({ focusWithin: focusWithin() }).content(naming),
          hidden: !open && !exiting && root.keepMounted(),
          ...(exiting ? { inert: "" } : {}),
        }
      },
      { owns: ["aria-label", "aria-labelledby"] },
    )
    const label = statics.get("aria-label")
    const labelledBy = statics.get("aria-labelledby")
    naming = {
      ...(label === undefined ? {} : { label }),
      ...(labelledBy === undefined ? {} : { labelledBy }),
    }
    const ready = injectRendered()
    effect((onCleanup) => {
      const mounted = ready() && presence.mounted()
      untracked(() => {
        root.contentMounted.set(mounted)
        if (!mounted || !(el instanceof HTMLElement)) return
        onCleanup(() => root.contentMounted.set(false))
        // Focus within, from the DOM (native events plus a frame check), reported to the machine.
        let inside = false
        const report = (now: boolean) => {
          if (now === inside) return
          inside = now
          focusWithin.set(now)
          root.send({ type: now ? "FOCUS_WITHIN.ENTER" : "FOCUS_WITHIN.LEAVE" })
        }
        const sync = () => {
          const active = el.ownerDocument.activeElement
          report(active !== null && el.contains(active))
        }
        const onFocusOut = (e: FocusEvent) => {
          const next = e.relatedTarget as Node | null
          if (next && el.contains(next)) return
          report(false)
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

@Directive({ selector: "[rindHoverCardArrow]", exportAs: "rindHoverCardArrow" })
export class HoverCardArrow {
  constructor() {
    const root = injectHoverCard("Arrow")
    bindProps(() => root.api().arrow())
  }
}

/**
 * The hover card's portal (`<ng-template rindHoverCardPortal>`), with the trigger as its
 * logical parent: the host carries its theme, dir and lang.
 */
@Directive({
  selector: "ng-template[rindHoverCardPortal]",
  exportAs: "rindHoverCardPortal",
  providers: PORTAL_PROVIDERS,
})
export class HoverCardPortal extends PortalBase {
  private readonly owner = injectHoverCard("Portal")
  protected parent(): Element | null {
    return this.owner.trigger()
  }
}

/** The Hover Card's parts, for a standalone component's `imports`. */
export const HoverCard = [
  HoverCardRoot,
  HoverCardTrigger,
  HoverCardPositioner,
  HoverCardContent,
  HoverCardArrow,
  HoverCardPortal,
] as const
