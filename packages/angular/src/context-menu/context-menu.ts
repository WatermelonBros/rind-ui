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
  isDevMode,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  type ContextMenuMessages,
  claimRegionEvent,
  contextMenuMessages,
  contextMenuRegionProps,
  createMenuTree,
  longPress,
  type MenuAnchorDetails,
  type MenuChangeDetails,
  type MenuPoint,
  type MessageOverrides,
  menuIds,
  menuLevelId,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId, RindIds } from "../ids"
import { injectModality, injectPress } from "../inject-press"
import { injectRendered } from "../layer-context"
import {
  injectMenuLevelService,
  MENU_LEVEL,
  type MenuLevel,
  MenuLevelInputs,
  type MenuState,
} from "../menu/menu"
import { injectEnvironment, injectMessages } from "../provider"

/** `openChangeDetails`'s details, with where and on what the opening gesture happened. */
export type ContextMenuChangeDetails = MenuChangeDetails & {
  readonly point: MenuPoint | null
  readonly target: Element | null
  readonly nativeEvent: Event | null
}

/** What an `openChangeDetails` output emits: the proposed visibility and why it changes. */
export interface ContextMenuChangeEvent {
  readonly value: boolean
  /** `details.cancel()`, called synchronously, vetoes the change. */
  readonly details: ContextMenuChangeDetails
}

const REGION = new InjectionToken<ContextMenuRoot>("rind-ui.context-menu")

const detailsOf = (d: MenuChangeDetails): ContextMenuChangeDetails => {
  const e = d.event as { point?: MenuPoint; target?: Element | null; nativeEvent?: Event }
  return {
    ...d,
    point: e.point ?? null,
    target: e.target ?? null,
    nativeEvent: e.nativeEvent ?? null,
  }
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A menu for a region: `<ng-container rindContextMenuRoot>` around a Trigger (the region; a
 * right click, a long press or the context-menu key opens it) and the Menu's Positioner and
 * Content, in `<ng-template rindMenuPortal>`.
 */
@Directive({
  selector: "[rindContextMenuRoot]",
  exportAs: "rindContextMenuRoot",
  providers: [
    { provide: MENU_LEVEL, useFactory: () => inject(forwardRef(() => ContextMenuRoot)).level },
    { provide: REGION, useExisting: forwardRef(() => ContextMenuRoot) },
  ],
})
export class ContextMenuRoot extends MenuLevelInputs {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id = input<string>()
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true. */
  readonly modal = input(true, { transform: booleanAttribute })
  /** The browser's own menu shows instead. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Default true: a touch or pen held on the region opens it. */
  readonly longPress = input(true, { transform: booleanAttribute })
  /** Default 500 ms. */
  readonly longPressDelay = input(500, { transform: numberAttribute })
  readonly keepMounted = input(false, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<ContextMenuMessages>>()
  readonly openChangeDetails = output<ContextMenuChangeEvent>()
  /** The accepted visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()
  /** A second gesture in the same region moved the open menu. */
  readonly anchorChange = output<MenuAnchorDetails>()

  /** @internal */
  readonly level: MenuLevel
  /** @internal */
  readonly texts: Signal<ContextMenuMessages>
  /** The menu's state, for the template (`#c="rindContextMenuRoot"`, `c.state()`). */
  readonly state: Signal<MenuState>

  constructor() {
    super()
    const levelId = menuLevelId(injectRootId(() => this.id())())
    this.texts = injectMessages("context-menu", contextMenuMessages, () => this.messages())
    const tree = createMenuTree({ parentKind: "context-menu" })
    const trigger = signal<HTMLElement | null>(null)
    const onOpenChange = (value: boolean, d: MenuChangeDetails) => {
      let cancelled = false
      this.openChangeDetails.emit({
        value,
        details: {
          ...detailsOf(d),
          cancel() {
            cancelled = true
            d.cancel()
          },
        },
      })
      if (!cancelled) this.openChange.emit(value)
    }
    const s = injectMenuLevelService({
      level: "root",
      levelId: () => levelId,
      tree,
      trigger,
      options: () => this.options(),
      controllable: () => ({
        open: this.open(),
        defaultOpen: this.defaultOpen(),
        onOpenChange,
        modal: this.modal(),
      }),
      region: () => ({ onAnchorChange: (d: MenuAnchorDetails) => this.anchorChange.emit(d) }),
    })
    this.level = {
      ...s,
      levelId,
      level: "root",
      tree,
      keepMounted: () => this.keepMounted(),
      trigger,
      contentMounted: signal(false),
      inMenubar: false,
      region: true,
    }
    const open = computed(() => s.view().matches("open"))
    this.state = computed(() => ({ open: open() }))
    if (inject(PLATFORM_ID) !== "browser" || !isDevMode()) return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    // Development: a controlled open with no gesture anchors at the region's corner.
    effect(() => {
      if (!ready() || this.open() !== true) return
      if (untracked(s.service).getSnapshot().context.regionAnchor === null) {
        console.warn(
          `[rind-ui] context-menu ${levelId}: opened without a point; it is placed at the region's top-left corner (use openAt)`,
        )
      }
    })
    // Development: the menu needs a name of its own (no trigger text names it).
    let named = false
    afterEveryRender(() => {
      if (named || !untracked(open)) return
      const content = document.getElementById(menuIds(levelId).content)
      if (!content) return
      named = true
      if (!content.getAttribute("aria-label") && !content.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] context-menu ${levelId}: the menu has no accessible name; pass aria-label to rindMenuContent`,
        )
      }
    })
  }

  /** Opens it at `point` (viewport coordinates), for `target` (e.g. a document listener). */
  openAt(point: MenuPoint, target: Element | null = null): void {
    this.level.send({ type: "OPEN_AT", point, target })
  }
  /** Closes it. */
  hide(): void {
    this.level.send({ type: "CLOSE" })
  }
}

/**
 * The region: `<div rindContextMenuTrigger>`. A right click, a long press or the context-menu
 * key on it opens the menu; a focusable region (`tabindex`) carries a hint for the long press.
 */
@Component({
  selector: "[rindContextMenuTrigger]",
  exportAs: "rindContextMenuTrigger",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content />@if (hint()) {<span [id]="hintId" hidden>{{ region.texts().longPressHint }}</span>}`,
})
export class ContextMenuTrigger {
  /** @internal */
  protected readonly region = inject(REGION, { optional: true }) as ContextMenuRoot
  /** @internal */
  protected readonly hintId = `${inject(RindIds).next()}-hint`
  /** @internal */
  protected readonly hint: Signal<boolean>

  constructor() {
    const level = inject(MENU_LEVEL, { optional: true })
    const region = this.region
    if (!level || !region) {
      throw new Error("rindContextMenuTrigger must be inside rindContextMenuRoot")
    }
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    // The hint only for a region the consumer made focusable, read after render (as React's).
    const focusable = el.hasAttribute("tabindex")
    const ready = injectRendered()
    this.hint = computed(() => ready() && focusable && region.longPress())
    if (inject(PLATFORM_ID) === "browser") {
      // The modality tracker classifies a contextmenu with no press before it (AT, keyboard).
      const destroy = inject(DestroyRef)
      afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
      level.trigger.set(el instanceof HTMLElement ? el : null)
      destroy.onDestroy(() => {
        if (untracked(level.trigger) === el) level.trigger.set(null)
      })
    }
    const send = level.send
    let start: MenuPoint = { x: 0, y: 0 }
    let target: Element | null = null
    const press = injectPress({
      env,
      // The delay read when a press starts: the Root's inputs are set after this part is made.
      longPress: {
        start: (gesture) =>
          longPress({ threshold: untracked(region.longPressDelay), moveTolerance: 10 }).start(
            gesture,
          ),
      },
      disabled: () => region.disabled() || !region.longPress(),
      send: (e) => {
        // Touch and pen only: a held mouse button is no long press.
        if (e.type !== "LONG_PRESS" || (e.pointerType !== "touch" && e.pointerType !== "pen")) {
          return
        }
        send({ type: "REGION.LONG_PRESS", point: start, target })
      },
    })
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    // Only the press module's pointer side (and its trailing-click and callout guards): keys
    // on the region and its rows stay the consumer's.
    const p = press.props
    bindProps(() =>
      joinHandlers(
        contextMenuRegionProps(
          {
            instance: level.levelId,
            open: level.view().matches("open"),
            disabled: region.disabled(),
            hintId: this.hint() ? this.hintId : undefined,
            focused: focused(),
            modality: modality(),
          },
          send,
          env,
        ),
        {
          onClick: p.onClick,
          onContextMenu: p.onContextMenu,
          onDragStart: p.onDragStart,
          onPointerEnter: p.onPointerEnter,
          onPointerLeave: p.onPointerLeave,
          // The region's own focus (a focusable region), not its rows'.
          onFocusIn: (e: FocusEvent) => focused.set(e.target === e.currentTarget),
          onFocusOut: (e: FocusEvent) => {
            if (e.target === e.currentTarget) focused.set(false)
          },
          onPointerDown: (e: PointerEvent) => {
            // The innermost region takes a long press; an outer one never starts its timer.
            if (e.pointerType === "mouse" || !claimRegionEvent(e)) return
            start = { x: e.clientX, y: e.clientY }
            target = e.target as Element
            p.onPointerDown(e as never)
          },
        },
      ),
    )
  }
}

/** The Context Menu's own parts; its menu is the Menu's (`Menu`'s Portal, Positioner, Content, items). */
export const ContextMenu = [ContextMenuRoot, ContextMenuTrigger] as const
