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
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  type WritableSignal,
} from "@angular/core"
import {
  contentSize,
  domHoverIntent,
  domPositioning,
  type HoverIntent,
  type MessageOverrides,
  type NavigationMenuLevel,
  type NavigationMenuMessages,
  type NavigationMenuProps,
  navigationMenuConnect,
  navigationMenuIds,
  navigationMenuLayerId,
  navigationMenuLevel,
  navigationMenuMachine,
  navigationMenuMessages,
  navigationMenuPositioning,
  type PositioningProps,
  type Service,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectFieldsetDisabled } from "../fieldset/context"
import { CONTROL_OVERRIDE, HostedControl } from "../hosted-control"
import { injectRootId, RindIds } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectParentLayer, injectRendered, LAYER, layerProvider } from "../layer-context"
import { Link } from "../link/link"
import { injectEnvironment, injectLocale, injectMessages, withCapabilities } from "../provider"
import { injectSelectionIndicator } from "../selection-indicator"

type Api = ReturnType<typeof navigationMenuConnect>

interface Positioned {
  readonly anchor: "trigger" | "list"
  readonly positioning?: PositioningProps | undefined
  /** One Positioner per item (around its Content), not one around the Viewport. */
  readonly perItem: boolean
}

interface Delays {
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
}

/** One level of a navigation menu (the root, or a Sub). Internal. */
interface LevelCtx {
  readonly service: () => Service<typeof navigationMenuMachine>
  readonly send: Service<typeof navigationMenuMachine>["send"]
  readonly root: () => string
  readonly api: Signal<Api>
  readonly value: Signal<string | null>
  readonly level: NavigationMenuLevel
  readonly orientation: () => "horizontal" | "vertical"
  readonly closedContent: () => "hidden" | "unmount"
  readonly disabled: () => boolean
  readonly hoverIntent: HoverIntent
  readonly items: Map<string, HTMLElement>
  readonly itemsVersion: WritableSignal<number>
  readonly disabledItems: Map<string, boolean>
  readonly viewport: WritableSignal<HTMLElement | null>
  /** Registers a Positioner: `slot` is its item's key, or `""` around the Viewport. */
  readonly registerPositioner: (slot: string, p: Positioned) => () => void
  readonly current: Signal<ReadonlySet<string>>
  readonly markCurrent: (key: string, on: boolean) => void
  /** The delays a Sub level inherits. */
  readonly delays: () => Delays
}

/** A panel, and the panel it is nested in (a current link marks every ancestor trigger). */
interface PanelCtx {
  readonly item: () => string
  readonly level: LevelCtx
  readonly parent: PanelCtx | null
}

interface ItemCtx {
  /** The level the item belongs to (a Sub's Positioner is not its parent item's). */
  readonly level: LevelCtx
  readonly key: () => string
  readonly contentMounted: WritableSignal<boolean>
}

const LEVEL = new InjectionToken<LevelCtx>("rind-ui.navigation-menu")
const ITEM = new InjectionToken<ItemCtx>("rind-ui.navigation-menu-item")
/** Inside a panel: links and nested triggers move with ArrowDown / ArrowUp. */
const PANEL = new InjectionToken<PanelCtx>("rind-ui.navigation-menu-panel")

function injectLevel(part: string): LevelCtx {
  const ctx = inject(LEVEL, { optional: true })
  if (!ctx) throw new Error(`rindNavigationMenu${part} must be inside rindNavigationMenuRoot`)
  return ctx
}

function injectItem(part: string): ItemCtx {
  const ctx = inject(ITEM, { optional: true })
  if (!ctx) throw new Error(`rindNavigationMenu${part} must be inside rindNavigationMenuItem`)
  return ctx
}

interface LevelInput {
  readonly value: string | null | undefined
  readonly defaultValue: string | null | undefined
  readonly onValueChange: NavigationMenuProps["onValueChange"]
  readonly orientation: "horizontal" | "vertical" | undefined
  readonly id: string | undefined
  readonly openOnHover?: boolean | undefined
  readonly disabled: boolean | undefined
  readonly openDelay?: number | undefined
  readonly closeDelay?: number | undefined
  readonly skipDelay?: number | undefined
  readonly patientClick?: number | undefined
  readonly closedContent: "hidden" | "unmount"
  readonly messages?: MessageOverrides<NavigationMenuMessages> | undefined
  readonly defaultOrientation: "horizontal" | "vertical"
}

/** One level's service and registries. Call in a constructor. */
function injectLevelState(own: () => LevelInput, parent: LevelCtx | null): LevelCtx {
  const root = injectRootId(() => own().id)
  const env = injectEnvironment()
  const navEnv = withCapabilities(env, {
    position: domPositioning(env),
    hoverIntent: domHoverIntent(env),
  })
  const locale = injectLocale(() => undefined)
  const messages = injectMessages("navigation-menu", navigationMenuMessages, () => own().messages)
  const items = new Map<string, HTMLElement>()
  const itemsVersion = signal(0)
  const disabledItems = new Map<string, boolean>()
  const viewport = signal<HTMLElement | null>(null)
  // Keyed per Positioner, so one item's Positioner going leaves the others registered.
  const positioners = signal<ReadonlyMap<string, Positioned>>(new Map())
  const registerPositioner = (slot: string, p: Positioned) => {
    positioners.set(new Map(untracked(positioners)).set(slot, p))
    return () => {
      if (untracked(positioners).get(slot) !== p) return
      const next = new Map(untracked(positioners))
      next.delete(slot)
      positioners.set(next)
    }
  }
  const current = signal<ReadonlySet<string>>(new Set())
  const markCurrent = (key: string, on: boolean) => {
    if (untracked(current).has(key) === on) return
    const next = new Set(untracked(current))
    if (on) next.add(key)
    else next.delete(key)
    current.set(next)
  }
  let send: Service<typeof navigationMenuMachine>["send"] | null = null
  const level = navigationMenuLevel(parent?.level ?? null, {
    close: () => send?.({ type: "LINK.ACTIVATE" }),
    parentClose: () => send?.({ type: "PARENT.CLOSE" }),
    openOnHover: () => untracked(own).openOnHover !== false,
  })
  if (parent && inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(parent.level.add(level)))
  }
  const parentLayer = injectParentLayer()
  const orientation = () => own().orientation ?? own().defaultOrientation
  // The open item's own Positioner, else the Viewport's, else any item's (a closed menu).
  // ponytail: read from the last value, so per-item `positioning` that differs between items
  // lags one switch; pass a per-key getter to the machine if that matters.
  let lastValue: string | null = null
  const positioner = (): Positioned | undefined =>
    positioners().get(lastValue ?? "") ??
    positioners().get("") ??
    positioners().values().next().value
  const machine = injectMachine(
    navigationMenuMachine,
    () => {
      const o = own()
      const p = positioner()
      return {
        value: o.value,
        defaultValue: o.defaultValue,
        onValueChange: o.onValueChange,
        openOnHover: level.openOnHover(),
        disabled: o.disabled,
        openDelay: o.openDelay,
        closeDelay: o.closeDelay,
        skipDelay: o.skipDelay,
        patientClick: o.patientClick,
        orientation: orientation(),
        root: root(),
        parent: parentLayer(),
        level,
        isItemDisabled: (key: string) => disabledItems.get(key) === true,
        positioned:
          p === undefined ? undefined : p.perItem ? ("item" as const) : ("level" as const),
        anchor: p?.anchor,
        positioning: p?.positioning,
      }
    },
    navEnv,
  )
  send = machine.send
  const value = computed(() => (machine.view().values.value as string | null | undefined) ?? null)
  const api = computed(() => {
    const v = value()
    lastValue = v
    itemsVersion()
    // Item order for the motion direction: document order of the registered items.
    const order = [...items.entries()]
      .sort(([, a], [, b]) => (a.compareDocumentPosition(b) & 4 ? -1 : 1))
      .map(([k]) => k)
    const view = machine.view()
    return navigationMenuConnect(
      {
        instance: root(),
        value: v,
        previous: view.context.previous,
        order,
        orientation: orientation(),
        dir: locale().dir,
        instant: view.context.instant,
        placement: view.context.placement,
        indicator: view.context.indicator,
        manual:
          navigationMenuPositioning({ positioning: positioner()?.positioning }).mode === "manual",
        messages: messages(),
      },
      machine.send,
    )
  })
  return {
    service: machine.service,
    send: machine.send,
    root,
    api,
    value,
    level,
    orientation,
    closedContent: () => own().closedContent,
    disabled: () => own().disabled === true,
    hoverIntent: navEnv.hoverIntent,
    items,
    itemsVersion,
    disabledItems,
    viewport,
    registerPositioner,
    current: current.asReadonly(),
    markCurrent,
    delays: () => ({
      openDelay: own().openDelay,
      closeDelay: own().closeDelay,
      skipDelay: own().skipDelay,
      patientClick: own().patientClick,
    }),
  }
}

/** What a `valueChangeDetails` output emits. */
export interface NavigationMenuValueEvent {
  readonly value: string | null
  readonly details: Parameters<NonNullable<NavigationMenuProps["onValueChange"]>>[1]
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/** The inputs of a level. */
@Directive()
abstract class LevelInputs {
  /** The open item's `value` (controlled, `[(value)]`); `null` when none is open. */
  readonly value = input<string | null>()
  /** The item open at first (uncontrolled). */
  readonly defaultValue = input<string | null>()
  /** `horizontal` (default for the root) or `vertical` (default for a Sub). */
  readonly orientation = input<"horizontal" | "vertical">()
  readonly id = input<string>()
  /** The open item changed; `details.reason` says why. */
  readonly valueChangeDetails = output<NavigationMenuValueEvent>()
  /** The open item's value, for `[(value)]`. */
  readonly valueChange = output<string | null>()
  /** @internal */
  protected readonly emitValue: NavigationMenuProps["onValueChange"] = (v, d) => {
    this.valueChangeDetails.emit({ value: v as string | null, details: d })
    this.valueChange.emit(v as string | null)
  }
}

/** The `navigation` landmark and its root level: `<nav rindNavigationMenuRoot>`. */
@Directive({
  selector: "[rindNavigationMenuRoot]",
  exportAs: "rindNavigationMenuRoot",
  providers: [
    { provide: LEVEL, useFactory: () => inject(forwardRef(() => NavigationMenuRoot)).ctx },
  ],
})
export class NavigationMenuRoot extends LevelInputs {
  /** Open items when a mouse or pen rests on their trigger (default true). */
  readonly openOnHover = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Disables every trigger. */
  readonly disabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Hover time before an item opens, in ms (default 200). */
  readonly openDelay = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Time before a hover-opened panel closes after the pointer left, in ms (default 300). */
  readonly closeDelay = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** After a close, hovering a trigger within this time opens it at once, in ms (default 300). */
  readonly skipDelay = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** A press this soon after a hover open keeps the panel open, in ms (default 500). */
  readonly patientClick = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /**
   * Closed panels: `hidden` (default) keeps them in the document with `hidden`, so their links
   * are crawlable and found by find-in-page indexing; `unmount` removes them after their exit
   * animation.
   */
  readonly closedContent = input<"hidden" | "unmount">("hidden")
  /** The landmark's default name (`label`, "Main"). */
  readonly messages = input<MessageOverrides<NavigationMenuMessages>>()

  /** @internal */
  readonly ctx: LevelCtx

  constructor() {
    super()
    this.ctx = injectLevelState(
      () => ({
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: this.emitValue,
        orientation: this.orientation(),
        id: this.id(),
        openOnHover: this.openOnHover(),
        disabled: this.disabled(),
        openDelay: this.openDelay(),
        closeDelay: this.closeDelay(),
        skipDelay: this.skipDelay(),
        patientClick: this.patientClick(),
        closedContent: this.closedContent(),
        messages: this.messages(),
        defaultOrientation: "horizontal",
      }),
      null,
    )
    let labelledBy: string | undefined
    const { statics } = bindProps(() => this.ctx.api().root({ labelledBy }), {
      owns: [
        "orientation",
        "openonhover",
        "disabled",
        "opendelay",
        "closedelay",
        "skipdelay",
        "patientclick",
        "closedcontent",
        "defaultvalue",
        "id",
      ],
    })
    labelledBy = statics.get("aria-labelledby")
  }
}

/** A nested level inside a Content: `<div rindNavigationMenuSub>`; not a landmark. */
@Directive({
  selector: "[rindNavigationMenuSub]",
  exportAs: "rindNavigationMenuSub",
  providers: [
    { provide: LEVEL, useFactory: () => inject(forwardRef(() => NavigationMenuSub)).ctx },
  ],
})
export class NavigationMenuSub extends LevelInputs {
  /** @internal */
  readonly ctx: LevelCtx
  constructor() {
    super()
    const parent = inject(LEVEL, { skipSelf: true, optional: true })
    if (!parent) throw new Error("rindNavigationMenuSub must be inside rindNavigationMenuRoot")
    this.ctx = injectLevelState(
      () => ({
        value: this.value(),
        defaultValue: this.defaultValue(),
        onValueChange: this.emitValue,
        orientation: this.orientation(),
        id: this.id(),
        disabled: parent.disabled(),
        ...parent.delays(),
        closedContent: parent.closedContent(),
        defaultOrientation: "vertical",
      }),
      parent,
    )
    bindProps(() => this.ctx.api().sub(), { owns: ["orientation", "defaultvalue", "id"] })
  }
}

/** The level's items: `<ul rindNavigationMenuList>`. */
@Directive({ selector: "[rindNavigationMenuList]", exportAs: "rindNavigationMenuList" })
export class NavigationMenuList {
  constructor() {
    const ctx = injectLevel("List")
    bindProps(() => ctx.api().list())
  }
}

/** One item: `<li rindNavigationMenuItem>`, a Link, a Trigger with its Content, or both. */
@Directive({
  selector: "[rindNavigationMenuItem]",
  exportAs: "rindNavigationMenuItem",
  providers: [
    { provide: ITEM, useFactory: () => inject(forwardRef(() => NavigationMenuItem)).item },
  ],
})
export class NavigationMenuItem {
  /** The item's key in the level's `value` (default: a generated, SSR-stable key). */
  readonly value = input<string>()
  /** @internal */
  readonly item: ItemCtx
  constructor() {
    const ctx = injectLevel("Item")
    const generated = inject(RindIds).next()
    const el: Element = inject(ElementRef).nativeElement
    const key = computed(() => this.value() ?? generated)
    this.item = { level: ctx, key, contentMounted: signal(false) }
    bindProps(() => ctx.api().item(key()), { owns: ["value"] })
    if (inject(PLATFORM_ID) !== "browser" || !(el instanceof HTMLElement)) return
    afterNextRender(() => {
      ctx.items.set(untracked(key), el)
      ctx.itemsVersion.update((n) => n + 1)
    })
    inject(DestroyRef).onDestroy(() => {
      ctx.items.delete(untracked(key))
      ctx.itemsVersion.update((n) => n + 1)
    })
  }
}

export interface NavigationMenuTriggerState {
  /** Its panel is open. */
  readonly open: boolean
}

/** The disclosure button that toggles the item's panel: `<button rindNavigationMenuTrigger>`. */
@Directive({ selector: "[rindNavigationMenuTrigger]", exportAs: "rindNavigationMenuTrigger" })
export class NavigationMenuTrigger {
  /** Never opens by press, keyboard or hover. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The trigger's state, for the template. */
  readonly state: Signal<NavigationMenuTriggerState>
  constructor() {
    const ctx = injectLevel("Trigger")
    const item = injectItem("Trigger")
    const panel = inject(PANEL, { optional: true })
    const env = injectEnvironment()
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    // rind's Fieldset and a native <fieldset disabled> disable it too (button-like-element).
    const fieldsetDisabled = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    const disabled = computed(
      () => this.disabled() || ctx.disabled() || fieldsetDisabled() || fieldsetDom(),
    )
    this.state = computed(() => ({ open: ctx.value() === item.key() }))
    const ready = injectRendered()
    effect((onCleanup) => {
      if (!ready()) return
      const d = disabled()
      const key = item.key()
      untracked(() => {
        ctx.disabledItems.set(key, d)
        if (d) ctx.send({ type: "DISABLED" })
      })
      onCleanup(() => ctx.disabledItems.delete(key))
    })
    if (inject(PLATFORM_ID) === "browser") {
      // The modality tracker needs a subscriber while the trigger is rendered.
      const destroy = inject(DestroyRef)
      const host: Element = inject(ElementRef).nativeElement
      afterNextRender(() => {
        destroy.onDestroy(env.modality.subscribe(() => {}))
        const watch = watchFieldsetDisabled(host, (d) => fieldsetDom.set(d))
        fieldsetDom.set(watch.disabled)
        destroy.onDestroy(watch.stop)
      })
    }
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") untracked(ctx.api).press(untracked(item.key), e.modality)
      },
      disabled: () => disabled(),
    })
    const hover = injectHover({ env, disabled: () => disabled(), send: () => {} })
    // Stable for the trigger's life: the handlers remember whether the pointer is on it.
    const intent = ctx.hoverIntent.triggerProps((e) =>
      ctx.send({ type: e.type, item: untracked(item.key) }),
    )
    bindProps(
      () =>
        joinHandlers(
          ctx.api().trigger(item.key(), {
            focused: focused(),
            modality: modality(),
            pressed: press.pressed(),
            hovered: hover.hovered(),
            tag,
            disabled: disabled(),
            current: ctx.current().has(item.key()),
            contentMounted: item.contentMounted(),
            inPanel: panel !== null,
          }),
          press.props,
          hover.props,
          { onPointerMove: intent.onPointerMove, onPointerLeave: intent.onPointerLeave },
          { onFocus: () => focused.set(true), onBlur: () => focused.set(false) },
        ),
      { owns: ["disabled"] },
    )
  }
}

/** Content size properties, after the render that changed `open` (collapsible's sequence). */
function injectSizeSequence(
  value: () => string | null,
  part: "content" | "viewport",
  enabled: () => boolean,
) {
  if (inject(PLATFORM_ID) !== "browser") return
  const node: Element = inject(ElementRef).nativeElement
  let size: ReturnType<typeof contentSize> | null = null
  let last: string | null | undefined
  let stop = () => {}
  afterEveryRender({
    write: () => {
      const v = untracked(value)
      const prev = last
      if (prev === v) return
      last = v
      stop()
      stop = () => {}
      if (!(node instanceof HTMLElement) || !untracked(enabled)) return
      size ??= contentSize(node, "rind-navigation-menu", part)
      const s = size
      if (v === null) {
        if (prev !== undefined && prev !== null) s.closed()
        return
      }
      if (prev === undefined) return s.opened({ instant: true })
      if (prev === null) s.opened({ instant: false })
      else s.switched()
      // Settled once the enter animations finished (or at once when nothing animates).
      const running = node.getAnimations?.({ subtree: true }) ?? []
      let live = true
      void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (live) s.settled()
      })
      stop = () => {
        live = false
      }
    },
  })
  inject(DestroyRef).onDestroy(() => stop())
}

export interface NavigationMenuContentState {
  /** The panel is open. */
  readonly open: boolean
}

/**
 * The item's panel: `<div rindNavigationMenuContent>`, in place, or moved into the level's
 * Viewport when one is rendered.
 */
@Directive({
  selector: "[rindNavigationMenuContent]",
  exportAs: "rindNavigationMenuContent",
  providers: [
    {
      provide: LAYER,
      useFactory: () => {
        const ctx = injectLevel("Content")
        // Layers opened from a panel (a nested level, a dialog) are this level's children.
        return layerProvider(
          () => navigationMenuLayerId(ctx.root()),
          () => "popover",
        )
      },
    },
    {
      provide: PANEL,
      useFactory: (): PanelCtx => ({
        item: injectItem("Content").key,
        level: injectLevel("Content"),
        parent: inject(PANEL, { optional: true, skipSelf: true }),
      }),
    },
  ],
})
export class NavigationMenuContent {
  /** The panel's state, for the template. */
  readonly state: Signal<NavigationMenuContentState>
  constructor() {
    const ctx = injectLevel("Content")
    const item = injectItem("Content")
    const el: Element = inject(ElementRef).nativeElement
    const open = computed(() => ctx.value() === item.key())
    this.state = computed(() => ({ open: open() }))
    const presence = injectPresence(open, el)
    const inViewport = () => ctx.viewport() !== null
    // In a shared viewport the outgoing panel goes at once: the viewport animates the switch.
    const switchedAway = () => inViewport() && ctx.value() !== null && !open()
    const exiting = () => !open() && !switchedAway() && presence.state() === "exiting"
    const mounted = computed(() => ctx.closedContent() === "hidden" || open() || exiting())
    injectSizeSequence(
      () => (open() ? item.key() : null),
      "content",
      () => !inViewport(),
    )
    bindProps(() => {
      if (!mounted()) return absentProps("navigation-menu", ctx.root())
      const isOpen = open()
      const leaving = exiting()
      return {
        ...ctx.api().content(item.key()),
        hidden: !isOpen && !leaving ? true : undefined,
        ...(leaving ? { inert: "" } : {}),
      }
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = injectRendered()
    effect((onCleanup) => {
      const m = ready() && mounted()
      untracked(() => item.contentMounted.set(m))
      if (m) onCleanup(() => untracked(() => item.contentMounted.set(false)))
    })
    // Into the level's Viewport while there is one (React's portal into it).
    effect(() => {
      const viewport = ctx.viewport()
      if (viewport && el.parentNode !== viewport) viewport.appendChild(el)
    })
  }
}

/** A link: `<a rindNavigationMenuLink href>`; a same-tab activation closes every open level. */
@Directive({
  selector: "[rindNavigationMenuLink]",
  exportAs: "rindNavigationMenuLink",
  providers: [{ provide: CONTROL_OVERRIDE, useFactory: () => new HostedControl() }],
  hostDirectives: [
    {
      directive: Link,
      inputs: [
        "href",
        "target",
        "rel",
        "download",
        "ping",
        "referrerpolicy",
        "hreflang",
        "routerOptions",
        "current",
      ],
      outputs: ["activate"],
    },
  ],
})
export class NavigationMenuLink {
  constructor() {
    const ctx = injectLevel("Link")
    const panel = inject(PANEL, { optional: true })
    const link = inject(Link, { self: true })
    const hosted = inject(CONTROL_OVERRIDE, { self: true })
    // Arrow keys find the link by its id.
    const generated = inject(RindIds).next()
    hosted.source = { id: () => `${ctx.root()}-link-${generated}` }
    link.activate.subscribe((details) => {
      if (details.disposition === "same-tab") ctx.level.closeTree()
    })
    bindProps(() => ctx.api().link({ inPanel: panel !== null }))
    // The current page marks the trigger of every panel the link is in, outermost included.
    const chain: { readonly item: () => string; readonly mark: LevelCtx["markCurrent"] }[] = []
    for (let p = panel; p; p = p.parent) chain.push({ item: p.item, mark: p.level.markCurrent })
    const on = computed(() => {
      const current = link.current()
      return current !== undefined && current !== false
    })
    const ready = injectRendered()
    effect((onCleanup) => {
      if (!ready() || !on()) return
      const keys = chain.map((c) => ({ key: untracked(c.item), mark: c.mark }))
      untracked(() => {
        for (const c of keys) c.mark(c.key, true)
      })
      onCleanup(() =>
        untracked(() => {
          for (const c of keys) c.mark(c.key, false)
        }),
      )
    })
  }
}

/** Decorative: the open trigger's box, `<li rindNavigationMenuIndicator>` inside the List. */
@Directive({ selector: "[rindNavigationMenuIndicator]", exportAs: "rindNavigationMenuIndicator" })
export class NavigationMenuIndicator {
  constructor() {
    const ctx = injectLevel("Indicator")
    injectSelectionIndicator({
      selectedId: () => {
        const v = untracked(ctx.value)
        return v === null ? null : navigationMenuIds(untracked(ctx.root)).trigger(v)
      },
      itemSelector: () => '[data-scope="navigation-menu"][data-part="trigger"]',
      collection: () => ctx.value() ?? ctx.itemsVersion(),
      onMeasure: (box, cause) => ctx.send({ type: "INDICATOR.MEASURE", box, cause }),
    })
    bindProps(() => ctx.api().indicator())
  }
}

/** The shared panel the open content renders into: `<div rindNavigationMenuViewport>`. */
@Directive({ selector: "[rindNavigationMenuViewport]", exportAs: "rindNavigationMenuViewport" })
export class NavigationMenuViewport {
  constructor() {
    const ctx = injectLevel("Viewport")
    const el: Element = inject(ElementRef).nativeElement
    const open = computed(() => ctx.value() !== null)
    const presence = injectPresence(open, el, { subtree: () => true })
    injectSizeSequence(
      () => ctx.value(),
      "viewport",
      () => true,
    )
    bindProps(() => {
      const exiting = !open() && presence.state() === "exiting"
      return { ...ctx.api().viewport(), hidden: !open() && !exiting ? true : undefined }
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // At once: the panels' first size pass already knows they render in it.
    ctx.viewport.set(el instanceof HTMLElement ? el : null)
    inject(DestroyRef).onDestroy(() => ctx.viewport.set(null))
  }
}

/**
 * Places the Viewport next to the open trigger (`<div rindNavigationMenuPositioner>` around
 * it); inside an Item (no Viewport), places that item's Content next to its own trigger.
 */
@Directive({
  selector: "[rindNavigationMenuPositioner]",
  exportAs: "rindNavigationMenuPositioner",
})
export class NavigationMenuPositioner {
  /** What the panel is placed against: the open trigger (default) or the whole list. */
  readonly anchor = input<"trigger" | "list">("trigger")
  /** Side, alignment and offsets (default below, aligned to the start, 4 px away). */
  readonly positioning = input<PositioningProps>()
  constructor() {
    const ctx = injectLevel("Positioner")
    const inItem = inject(ITEM, { optional: true })
    // An item of this level (a Sub's Positioner sits in its parent's item, not its own).
    const own = inItem?.level === ctx ? inItem : undefined
    const item = () => own?.key()
    const el: Element = inject(ElementRef).nativeElement
    const open = computed(() => {
      const k = item()
      return k === undefined ? ctx.value() !== null : ctx.value() === k
    })
    const presence = injectPresence(open, el, { subtree: () => true })
    const perItem = own !== undefined
    // Registered once rendered (as React's effect, after the machine started).
    const ready = injectRendered()
    effect((onCleanup) => {
      if (!ready()) return
      const anchor = this.anchor()
      const positioning = this.positioning()
      const slot = item() ?? ""
      onCleanup(untracked(() => ctx.registerPositioner(slot, { anchor, positioning, perItem })))
    })
    bindProps(
      () => {
        const exiting = !open() && presence.state() === "exiting"
        return { ...ctx.api().positioner(item()), hidden: !open() && !exiting ? true : undefined }
      },
      { owns: ["anchor"] },
    )
  }
}

/** The Navigation Menu's parts, for a standalone component's `imports`. */
export const NavigationMenu = [
  NavigationMenuRoot,
  NavigationMenuSub,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  NavigationMenuPositioner,
] as const
