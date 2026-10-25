import {
  afterNextRender,
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
  accessibleNameOf,
  domDelayGroup,
  domHoverIntent,
  domPositioning,
  focusEvent,
  type HoverIntent,
  type PositioningProps,
  type Service,
  type TooltipChangeDetails,
  type TooltipProps,
  tooltipConnect,
  tooltipIds,
  tooltipMachine,
  tooltipPositioning,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality } from "../inject-press"
import { injectParentLayer, injectRendered } from "../layer-context"
import { PORTAL_PROVIDERS, PortalBase } from "../portal"
import { injectEnvironment, withCapabilities } from "../provider"

const TOOLTIP = new InjectionToken<TooltipRoot>("rind-ui.tooltip")

function injectTooltip(part: string): TooltipRoot {
  const root = inject(TOOLTIP, { optional: true })
  if (!root) throw new Error(`rindTooltip${part} must be inside rindTooltipRoot`)
  return root
}

/** What a `openChangeDetails` output emits: the proposed visibility and why it changes. */
export interface TooltipChangeEvent {
  readonly value: boolean
  /** `details.cancel()`, called synchronously, vetoes the change. */
  readonly details: TooltipChangeDetails
}

export interface TooltipState {
  readonly open: boolean
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/**
 * A short text shown on hover and focus, describing (or naming) its trigger:
 * `<ng-container rindTooltipRoot>` with a Trigger and, usually in
 * `<ng-template rindTooltipPortal>`, a Positioner holding the Content.
 */
@Directive({
  selector: "[rindTooltipRoot]",
  exportAs: "rindTooltipRoot",
  providers: [{ provide: TOOLTIP, useExisting: forwardRef(() => TooltipRoot) }],
})
export class TooltipRoot {
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
  /** The delay group's warm window after this tooltip closes (default 300 ms; 0: none). */
  readonly skipDelay = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Pressing the trigger closes it (default true). */
  readonly closeOnPress = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly positioning = input<PositioningProps>()
  /** Base for the ids of the tooltip's parts. Default: generated. */
  readonly id = input<string>()
  /** `description` (default): the text describes the trigger. `label`: it names it. */
  readonly type = input<"description" | "label">("description")
  readonly openChangeDetails = output<TooltipChangeEvent>()
  /** The accepted visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()

  /** @internal */
  readonly root: () => string
  /** @internal */
  readonly view: ReturnType<typeof injectMachine<typeof tooltipMachine>>["view"]
  /** @internal */
  readonly send: Service<typeof tooltipMachine>["send"]
  /** @internal */
  readonly props: () => TooltipProps
  /** @internal */
  readonly hoverIntent: HoverIntent
  /** @internal The trigger by reference: a rind-ui part used as the trigger keeps its own id. */
  readonly trigger = signal<HTMLElement | null>(null)
  /** @internal */
  readonly contentMounted = signal(false)
  /** @internal */
  readonly isOpen: () => boolean
  /** The tooltip's state, for the template (`#t="rindTooltipRoot"`, `t.state()`). */
  readonly state: Signal<TooltipState>

  constructor() {
    const root = injectRootId(() => this.id())
    this.root = root
    const parent = injectParentLayer()
    const env = injectEnvironment()
    // Positioning, hover intent and the delay group only for components that use them.
    const tooltipEnv = withCapabilities(env, {
      position: domPositioning(env),
      hoverIntent: domHoverIntent(env),
      delayGroup: domDelayGroup(env),
    })
    this.hoverIntent = tooltipEnv.hoverIntent
    // As changeEmitter, for the tooltip's own details type (its reasons are the tooltip's).
    const onOpenChange = (value: boolean, d: TooltipChangeDetails) => {
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
    this.props = (): TooltipProps => ({
      open: this.open(),
      defaultOpen: this.defaultOpen(),
      onOpenChange,
      openDelay: this.openDelay(),
      closeDelay: this.closeDelay(),
      skipDelay: this.skipDelay(),
      closeOnPress: this.closeOnPress(),
      disabled: this.disabled(),
      positioning: this.positioning(),
      root: root(),
      parent: parent(),
      getTrigger: () => untracked(this.trigger),
    })
    const { view, send } = injectMachine(tooltipMachine, this.props, tooltipEnv)
    this.view = view
    this.send = send
    this.isOpen = () => view().values.open
    this.state = computed(() => ({ open: view().values.open }))
  }

  /** @internal */
  api(dir?: "ltr" | "rtl") {
    const view = this.view()
    return tooltipConnect(
      {
        instance: this.root(),
        open: view.values.open,
        instant: view.context.instant,
        placement: view.context.placement,
        type: this.type(),
        contentMounted: this.contentMounted(),
        dir,
        manual: tooltipPositioning(this.props()).mode === "manual",
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

/** Development warnings about the trigger and the content, once per mount (design §6). */
function injectDevWarnings(root: TooltipRoot, ready: Signal<boolean>) {
  if (!isDevMode()) return
  // Re-run once the (portalled) content rendered: it is what the content checks read.
  effect(() => {
    const el = root.trigger()
    if (!ready() || !el || !root.contentMounted()) return
    const type = root.type()
    const id = root.root()
    untracked(() => {
      const name = `tooltip #${el.id}`
      if (el.matches(":disabled")) {
        console.warn(
          `[rind-ui] ${name}: the trigger is disabled, so it cannot be focused or hovered; use focusableWhenDisabled (aria-disabled)`,
        )
      } else if (el.tabIndex < 0) {
        console.warn(`[rind-ui] ${name}: the trigger is not focusable; keyboard users never see it`)
      }
      if (type === "label" && el.hasAttribute("aria-label")) {
        console.warn(
          `[rind-ui] ${name}: aria-label on a type="label" trigger is ignored by assistive technology (aria-labelledby wins)`,
        )
      }
      const content = el.ownerDocument.getElementById(tooltipIds(id).content)
      if (!content) return
      // Hidden closed content still holds what it will show: any tabbable descendant.
      const tabbable = content.querySelector<HTMLElement>(
        "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
      )
      if (tabbable) {
        console.warn(
          `[rind-ui] ${name}: its content contains a tabbable element (${tabbable.tagName.toLowerCase()}); tooltips are never focused — use a Hover Card or a Popover`,
        )
      }
      if (type === "description") {
        const text = (content.textContent ?? "").trim()
        if (text !== "" && text === accessibleNameOf(el).trim()) {
          console.warn(
            `[rind-ui] ${name}: the description repeats the trigger's name; use type="label"`,
          )
        }
      }
    })
  })
}

/**
 * The element the tooltip describes: `<button rindTooltipTrigger>`. On another rind-ui part
 * (`<button rindSwitchRoot rindTooltipTrigger>`) that part keeps its own id and attributes; the
 * trigger adds only the reference to the content and the hover handlers.
 */
@Directive({ selector: "[rindTooltipTrigger]", exportAs: "rindTooltipTrigger" })
export class TooltipTrigger {
  constructor() {
    const root = injectTooltip("Trigger")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    // Another rind-ui part on the same element: it keeps its own identity.
    const foreign = el
      .getAttributeNames()
      .some((n) => n.toLowerCase().startsWith("rind") && n.toLowerCase() !== "rindtooltiptrigger")
    const focused = signal(false)
    const hovered = signal(false)
    const modality = injectModality(env.modality, focused)
    const ready = injectRendered()
    injectDevWarnings(root, ready)
    const hover = root.hoverIntent.triggerProps((e) => root.send(e))
    const api = () => untracked(() => root.api())
    let naming: { describedBy?: string; labelledBy?: string } = {}
    const { statics } = bindProps(
      () =>
        joinHandlers(
          root.api().trigger(
            {
              focused: focused(),
              hovered: hovered(),
              modality: modality(),
              ...naming,
              foreign,
            },
            hover,
          ),
          {
            onPointerMove: (e: PointerEvent) => {
              if (e.pointerType === "mouse" || e.pointerType === "pen") hovered.set(true)
            },
            onPointerLeave: () => hovered.set(false),
            onPointerDown: (e: PointerEvent) =>
              api().pressStart(e.pointerType === "mouse" || e.pointerType === "pen"),
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") api().pressStart(false)
            },
            // Assistive technology activates with a bare click (no pointer or key events).
            onClick: (e: MouseEvent) => {
              if (e.detail === 0) api().pressStart(false)
            },
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
      { owns: ["aria-describedby", "aria-labelledby"] },
    )
    const describedBy = statics.get("aria-describedby")
    const labelledBy = statics.get("aria-labelledby")
    naming = {
      ...(describedBy === undefined ? {} : { describedBy }),
      ...(labelledBy === undefined ? {} : { labelledBy }),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    root.trigger.set(el instanceof HTMLElement ? el : null)
    // The modality tracker needs a subscriber while the trigger is rendered.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    destroy.onDestroy(() => {
      if (untracked(root.trigger) === el) root.trigger.set(null)
    })
  }
}

/** Always rendered (the description exists while closed); hidden once the exit ends. */
function injectPart(root: TooltipRoot) {
  const el: Element = inject(ElementRef).nativeElement
  const presence = injectPresence(() => root.isOpen(), el, {
    keepMounted: () => true,
    subtree: () => true,
  })
  // Hidden only once presence is over: the update that closes is still "present", and hiding
  // there would cut the exit animation.
  return () => !root.isOpen() && presence.state() === "absent"
}

/** Places the content against the trigger: `<div rindTooltipPositioner>`. */
@Directive({ selector: "[rindTooltipPositioner]", exportAs: "rindTooltipPositioner" })
export class TooltipPositioner {
  constructor() {
    const root = injectTooltip("Positioner")
    const hidden = injectPart(root)
    // The trigger's direction: the portalled positioner carries it (inline sides, RTL).
    const dir = signal<"ltr" | "rtl" | undefined>(undefined)
    const ready = injectRendered()
    effect(() => {
      if (!ready() || !root.isOpen()) return
      const found = root.trigger()?.closest("[dir]")?.getAttribute("dir")
      dir.set(found === "rtl" ? "rtl" : "ltr")
    })
    bindProps(() => ({ ...root.api(dir()).positioner(), hidden: hidden() }))
  }
}

/** The tooltip's text: `<div rindTooltipContent>`. Never focusable. */
@Directive({ selector: "[rindTooltipContent]", exportAs: "rindTooltipContent" })
export class TooltipContent {
  constructor() {
    const root = injectTooltip("Content")
    const hidden = injectPart(root)
    bindProps(() => ({ ...root.api().content(), hidden: hidden() }))
    // Referenced by the trigger only once it exists: a portalled content renders after
    // hydration, so the server markup never has a dangling IDREF.
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => root.contentMounted.set(true))
    inject(DestroyRef).onDestroy(() => root.contentMounted.set(false))
  }
}

@Directive({ selector: "[rindTooltipArrow]", exportAs: "rindTooltipArrow" })
export class TooltipArrow {
  constructor() {
    const root = injectTooltip("Arrow")
    bindProps(() => root.api().arrow())
  }
}

/**
 * The tooltip's portal (`<ng-template rindTooltipPortal>`), with the trigger as its logical
 * parent: the host carries its theme, dir and lang.
 */
@Directive({
  selector: "ng-template[rindTooltipPortal]",
  exportAs: "rindTooltipPortal",
  providers: PORTAL_PROVIDERS,
})
export class TooltipPortal extends PortalBase {
  private readonly owner = injectTooltip("Portal")
  protected parent(): Element | null {
    return this.owner.trigger()
  }
  // Closed tooltips cost nothing: the host follows the trigger's theme only while open.
  protected override follows(): boolean {
    return this.owner.isOpen() && this.observe()
  }
}

/** The Tooltip's parts, for a standalone component's `imports`. */
export const Tooltip = [
  TooltipRoot,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
  TooltipArrow,
  TooltipPortal,
] as const
