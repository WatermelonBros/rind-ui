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
  untracked,
} from "@angular/core"
import {
  domPositioning,
  type FocusTarget,
  type HeadingLevel,
  type LayerMeta,
  type MessageOverrides,
  type PopoverCloseReason,
  type PopoverDismissEvent,
  type PopoverEvent,
  type PopoverMessages,
  type PopoverProps,
  type PositioningProps,
  partId,
  popoverConnect,
  popoverIds,
  popoverLayerId,
  popoverMachine,
  popoverMessages,
  popoverPositioning,
  type Service,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { HEADING_LEVEL } from "../heading/heading"
import { injectRootId } from "../ids"
import { injectButton } from "../inject-button"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality } from "../inject-press"
import { injectLayerMeta, injectParentLayer, LAYER, layerProvider } from "../layer-context"
import { PORTAL_PROVIDERS, PortalBase } from "../portal"
import { injectEnvironment, injectMessages, withCapabilities } from "../provider"

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

const POPOVER = new InjectionToken<PopoverRoot>("rind-ui.popover")

/**
 * The parts' `data-scope` for a composite hosting the Root as a host directive (Table's
 * filters), where the `scope` input cannot be set. Internal.
 */
export const POPOVER_SCOPE = new InjectionToken<string>("rind-ui.popover-scope")

function injectPopover(part: string): PopoverRoot {
  const root = inject(POPOVER, { optional: true })
  if (!root) throw new Error(`rindPopover${part} must be inside rindPopoverRoot`)
  return root
}

/**
 * For components composed on the Popover (Date Field's picker): the enclosing Popover's open
 * state and its `send`, or null outside one. Not exported from the package.
 */
export function injectPopoverControls(): {
  readonly open: () => boolean
  readonly send: Service<typeof popoverMachine>["send"]
} | null {
  const root = inject(POPOVER, { optional: true })
  return root ? { open: () => root.isOpen(), send: root.send } : null
}

export interface PopoverState {
  readonly open: boolean
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A non-modal (or modal) dialog anchored to its trigger: `<ng-container rindPopoverRoot>` (no
 * element of its own) with a Trigger and, usually in `<ng-template rindPopoverPortal>`, a
 * Positioner holding the Content.
 */
@Directive({
  selector: "[rindPopoverRoot]",
  exportAs: "rindPopoverRoot",
  providers: [{ provide: POPOVER, useExisting: forwardRef(() => PopoverRoot) }],
})
export class PopoverRoot {
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default false. */
  readonly modal = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true. */
  readonly closeOnEscape = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true. */
  readonly closeOnInteractOutside = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  /** Elements whose presses and focus count as inside (a toast). */
  readonly persistentElements = input<() => readonly Element[]>()
  /** `false`: focus stays; `null` or a function returning null: the default rule. */
  readonly initialFocus = input<(() => FocusTarget) | null>()
  /** `false`: focus does not move back; `null`: the trigger. */
  readonly finalFocus = input<
    ((reason: PopoverCloseReason | undefined) => FocusTarget) | null | false
  >()
  /** Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning). */
  readonly positioning = input<PositioningProps>()
  /** Base for the ids of the popover's parts. Default: generated. */
  readonly id = input<string>()
  /** Positioner and content stay rendered (hidden) while closed. */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<PopoverMessages>>()
  /** The parts' `data-scope`, for composites (Table's filters): internal. */
  readonly scope = input<string>()
  readonly openChangeDetails = output<ChangeEvent<boolean, PopoverEvent>>()
  /** The accepted visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()
  /** Escape is about to close it; `event.preventDefault()` keeps it open. */
  readonly escapeKeyDown = output<PopoverDismissEvent>()
  /** A press or focus outside is about to close it; `event.preventDefault()` keeps it open. */
  readonly interactOutside = output<PopoverDismissEvent>()

  private readonly emit = changeEmitter<boolean, PopoverEvent>(
    this.openChangeDetails,
    this.openChange,
  )
  /** @internal */
  readonly root: () => string
  /** @internal */
  readonly scopeName = computed(() => this.scope() ?? this.hostScope ?? "popover")
  private readonly hostScope = inject(POPOVER_SCOPE, { optional: true })
  /** @internal */
  readonly view: ReturnType<typeof injectMachine<typeof popoverMachine>>["view"]
  /** @internal */
  readonly send: Service<typeof popoverMachine>["send"]
  /** @internal */
  readonly props: () => PopoverProps
  /** @internal */
  readonly contentMounted = signal(false)
  /** @internal */
  readonly anchorRendered = signal(false)
  /** @internal */
  readonly titleLevel = signal<HeadingLevel>(2)
  /** @internal */
  readonly rendered = signal<Rendered>({})
  /** @internal The stack's metadata for this layer, followed while open. */
  readonly meta: Signal<LayerMeta | undefined>
  /** @internal */
  readonly texts: Signal<PopoverMessages>
  /** @internal */
  readonly isOpen: () => boolean
  /** The popover's state, for the template (`#p="rindPopoverRoot"`, `p.state()`). */
  readonly state: Signal<PopoverState>

  constructor() {
    const root = injectRootId(() => this.id())
    this.root = root
    const parent = injectParentLayer()
    this.texts = injectMessages("popover", popoverMessages, () => this.messages())
    const env = injectEnvironment()
    // Positioning only for anchored components: not part of domEnvironment().
    const withPosition = withCapabilities(env, { position: domPositioning(env) })
    this.props = (): PopoverProps => ({
      open: this.open(),
      defaultOpen: this.defaultOpen(),
      onOpenChange: this.emit,
      modal: this.modal(),
      disabled: this.disabled(),
      closeOnEscape: this.closeOnEscape(),
      closeOnInteractOutside: this.closeOnInteractOutside(),
      onEscapeKeyDown: (e) => this.escapeKeyDown.emit(e),
      onInteractOutside: (e) => this.interactOutside.emit(e),
      persistentElements: this.persistentElements(),
      initialFocus: this.initialFocus(),
      finalFocus: this.finalFocus(),
      positioning: this.positioning(),
      root: root(),
      parent: parent(),
      anchored: this.anchorRendered(),
      scope: this.scope() ?? this.hostScope ?? undefined,
    })
    const { view, send } = injectMachine(popoverMachine, this.props, withPosition)
    this.view = view
    this.send = send
    this.isOpen = () => view().matches("open")
    this.state = computed(() => ({ open: view().matches("open") }))
    this.meta = injectLayerMeta(this.isOpen, () => popoverLayerId(root()))
  }

  /** @internal The connect output, with a part's focus state. */
  api(
    extra: {
      dir?: "ltr" | "rtl"
      focusWithin?: boolean
      contentFocused?: boolean
      modality?: Parameters<typeof popoverConnect>[0]["modality"]
    } = {},
  ) {
    const view = this.view()
    const props = this.props()
    return popoverConnect(
      {
        instance: this.root(),
        scope: this.scopeName(),
        open: view.matches("open"),
        modal: props.modal === true,
        disabled: props.disabled,
        placement: view.context.placement,
        closeReason: view.context.closeReason,
        rendered: this.rendered(),
        contentMounted: this.contentMounted(),
        anchorRendered: this.anchorRendered(),
        meta: this.meta(),
        manual: popoverPositioning(props).mode === "manual",
        ...extra,
        messages: this.texts(),
      },
      this.send,
    )
  }

  /** Opens it. */
  show(): void {
    this.send({ type: "open" })
  }
  /** Closes it. */
  hide(): void {
    this.send({ type: "api", close: true })
  }
  /** Recomputes the position (a moved anchor the tracking cannot see). */
  reposition(): void {
    this.send({ type: "POSITION.REPOSITION" })
  }
}

/** Opens and closes the popover: `<button rindPopoverTrigger>`. */
@Directive({ selector: "[rindPopoverTrigger]", exportAs: "rindPopoverTrigger" })
export class PopoverTrigger {
  constructor() {
    const root = injectPopover("Trigger")
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    const b = injectButton(
      (m) => untracked(() => root.api()).pressTrigger(m),
      () => root.props().disabled === true,
    )
    bindProps(() =>
      joinHandlers(
        root.api().trigger({
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

/** Optional: positions the content against this element instead of the trigger. */
@Directive({ selector: "[rindPopoverAnchor]", exportAs: "rindPopoverAnchor" })
export class PopoverAnchor {
  constructor() {
    const root = injectPopover("Anchor")
    bindProps(() => root.api().anchor())
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => root.anchorRendered.set(true))
    inject(DestroyRef).onDestroy(() => root.anchorRendered.set(false))
  }
}

@Directive({ selector: "[rindPopoverIndicator]", exportAs: "rindPopoverIndicator" })
export class PopoverIndicator {
  constructor() {
    const root = injectPopover("Indicator")
    bindProps(() => root.api().indicator())
  }
}

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
function injectAnchorDir(root: PopoverRoot): Signal<"ltr" | "rtl" | undefined> {
  const dir = signal<"ltr" | "rtl" | undefined>(undefined)
  if (inject(PLATFORM_ID) !== "browser") return dir
  const env = injectEnvironment()
  afterEveryRender(() => {
    if (!untracked(root.isOpen)) return
    const ids = popoverIds(untracked(root.root), untracked(root.scopeName))
    const anchor = env.dom.getById(untracked(root.anchorRendered) ? ids.anchor : ids.trigger)
    const found = anchor?.closest("[dir]")?.getAttribute("dir")
    const next = found === "rtl" ? "rtl" : "ltr"
    if (untracked(dir) !== next) dir.set(next)
  })
  return dir
}

/** Places the content against the anchor: `<div rindPopoverPositioner>`. */
@Directive({ selector: "[rindPopoverPositioner]", exportAs: "rindPopoverPositioner" })
export class PopoverPositioner {
  constructor() {
    const root = injectPopover("Positioner")
    const el: Element = inject(ElementRef).nativeElement
    const dir = injectAnchorDir(root)
    // It holds the content: it stays while the content's exit animations run.
    const presence = injectPresence(() => root.isOpen(), el, {
      keepMounted: () => root.keepMounted(),
      subtree: () => true,
    })
    bindProps(() => {
      if (!presence.mounted()) return absentProps(root.scopeName(), root.root())
      const d = dir()
      return {
        ...root.api(d ? { dir: d } : {}).positioner(),
        hidden: !root.isOpen() && root.keepMounted(),
      }
    })
  }
}

/**
 * The popover's dialog: `<div rindPopoverContent>`. Headings inside are one level below its
 * Title; layers opened from it are its children.
 */
@Directive({
  selector: "[rindPopoverContent]",
  exportAs: "rindPopoverContent",
  providers: [
    {
      provide: LAYER,
      useFactory: () => {
        const root = injectPopover("Content")
        return layerProvider(
          () => popoverLayerId(root.root()),
          () => "popover",
        )
      },
    },
    {
      provide: HEADING_LEVEL,
      useFactory: () => {
        const root = injectPopover("Content")
        return computed(() => Math.min(6, root.titleLevel() + 1))
      },
    },
  ],
})
export class PopoverContent {
  constructor() {
    const root = injectPopover("Content")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focusWithin = signal(false)
    const contentFocused = signal(false)
    const modality = injectModality(env.modality, contentFocused)
    const presence = injectPresence(() => root.isOpen(), el, {
      keepMounted: () => root.keepMounted(),
    })
    let naming: { label?: string; labelledBy?: string; describedBy?: string } = {}
    const { statics } = bindProps(
      () => {
        if (!presence.mounted()) return absentProps(root.scopeName(), root.root())
        const open = root.isOpen()
        const exiting = !open && presence.state() === "exiting"
        const own = root
          .api({
            focusWithin: focusWithin(),
            contentFocused: contentFocused(),
            modality: modality(),
          })
          .content(naming)
        return {
          ...own,
          hidden: !open && !exiting && root.keepMounted(),
          ...(exiting ? { inert: "" } : {}),
        }
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
        // Focus within, from the DOM itself (as the Dialog: native events plus a frame check).
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

@Directive({ selector: "[rindPopoverArrow]", exportAs: "rindPopoverArrow" })
export class PopoverArrow {
  constructor() {
    const root = injectPopover("Arrow")
    bindProps(() => root.api().arrow())
  }
}

/** Registers a title/description part with the Root while it is rendered. */
function injectRegistered(root: PopoverRoot, part: "title" | "description") {
  if (inject(PLATFORM_ID) !== "browser") return
  const ready = signal(false)
  afterNextRender(() => ready.set(true))
  effect((onCleanup) => {
    if (!ready()) return
    const id = partId(root.scopeName(), root.root(), part)
    untracked(() => root.rendered.set({ ...root.rendered(), [part]: id }))
    onCleanup(() => untracked(() => root.rendered.set({ ...root.rendered(), [part]: undefined })))
  })
}

/** The content's name: `<h2 rindPopoverTitle>` (its element's level, else `level`). */
@Directive({ selector: "[rindPopoverTitle]", exportAs: "rindPopoverTitle" })
export class PopoverTitle {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level = input<HeadingLevel>(2)
  constructor() {
    const root = injectPopover("Title")
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    injectRegistered(root, "title")
    effect(() => {
      const level = this.level()
      untracked(() => root.titleLevel.set(level))
    })
    bindProps(() => root.api().title({ level: this.level(), tag }), { owns: ["level"] })
  }
}

@Directive({ selector: "[rindPopoverDescription]", exportAs: "rindPopoverDescription" })
export class PopoverDescription {
  constructor() {
    const root = injectPopover("Description")
    injectRegistered(root, "description")
    bindProps(() => root.api().description())
  }
}

/** Closes it: `<button rindPopoverCloseTrigger>`; an empty one (an icon) is named "Close". */
@Directive({ selector: "[rindPopoverCloseTrigger]", exportAs: "rindPopoverCloseTrigger" })
export class PopoverCloseTrigger {
  constructor() {
    const root = injectPopover("CloseTrigger")
    const el: Element = inject(ElementRef).nativeElement
    const b = injectButton((m) => untracked(() => root.api()).pressClose(m))
    // No content of its own (an icon): named by messages.close.
    const empty = signal(false)
    bindProps(() =>
      joinHandlers(
        root.api().closeTrigger({
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

/**
 * The popover's portal (`<ng-template rindPopoverPortal>`), with the trigger as its logical
 * parent: the host carries its theme, dir and lang.
 */
@Directive({
  selector: "ng-template[rindPopoverPortal], ng-template[rindTableFilterPortal]",
  exportAs: "rindPopoverPortal",
  providers: PORTAL_PROVIDERS,
})
export class PopoverPortal extends PortalBase {
  private readonly owner = injectPopover("Portal")
  private readonly env = injectEnvironment()
  protected parent(): Element | null {
    return this.env.dom.getById(popoverIds(this.owner.root(), this.owner.scopeName()).trigger)
  }
}

/** The Popover's parts, for a standalone component's `imports`. */
export const Popover = [
  PopoverRoot,
  PopoverTrigger,
  PopoverAnchor,
  PopoverIndicator,
  PopoverPositioner,
  PopoverContent,
  PopoverArrow,
  PopoverTitle,
  PopoverDescription,
  PopoverCloseTrigger,
  PopoverPortal,
] as const
