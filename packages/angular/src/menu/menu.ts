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
  announcerCapability,
  type CollectionKey,
  createListCollection,
  createMenuTree,
  domHoverIntent,
  domPositioning,
  elementDir,
  type HoverIntent,
  type Href,
  type ItemRegistry,
  type LayerMeta,
  layoutCapability,
  linkProps,
  type MenuActivation,
  type MenuChangeDetails,
  type MenuItemKind,
  type MenuLevelId,
  type MenuParentKind,
  type MenuProps,
  type MenuTree,
  type MenuTreeHost,
  menuConnect,
  menuIds,
  menuLayerId,
  menuLevelId,
  menuMachine,
  menuPositioning,
  menuRadioGroupMachine,
  type PartProps,
  type PositioningProps,
  type RouterOptions,
  type Service,
  toggleMachine,
  toKey,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectCollectionItems, injectRegisterItem } from "../collection-items"
import { injectRootId, RindIds } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality, injectPress } from "../inject-press"
import {
  injectLayerMeta,
  injectParentLayer,
  injectRendered,
  LAYER,
  layerProvider,
} from "../layer-context"
import { PORTAL_PROVIDERS, PortalBase } from "../portal"
import { injectEnvironment, withCapabilities } from "../provider"

/**
 * Runs `fn` and returns the last element it tried to focus while that element was inert (a
 * refused move), or null. Synchronous: the prototype is restored before returning.
 */
function focusCalls(fn: () => void): HTMLElement | null {
  if (typeof HTMLElement === "undefined") {
    fn()
    return null
  }
  const proto = HTMLElement.prototype
  const original = proto.focus
  let blocked: HTMLElement | null = null
  proto.focus = function (this: HTMLElement, options?: FocusOptions) {
    original.call(this, options)
    blocked =
      this.ownerDocument.activeElement === this ? null : this.closest("[inert]") ? this : null
  }
  try {
    fn()
  } finally {
    proto.focus = original
  }
  return blocked
}

/** Controls keep their own role inside the menu (a search field, a native button). */
const INTERACTIVE = "input, select, textarea, button, a[href], [tabindex], [contenteditable]"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/** `select`'s details: `cancel()` keeps the menu open. */
export interface MenuSelectDetails {
  readonly key: CollectionKey
  readonly kind: MenuItemKind
  readonly modality: MenuActivation["modality"]
  cancel(): void
}

/** What an `openChangeDetails` output emits: the proposed visibility and why it changes. */
export interface MenuChangeEvent {
  readonly value: boolean
  /** `details.cancel()`, called synchronously, vetoes the change. */
  readonly details: MenuChangeDetails
}

export interface MenuState {
  readonly open: boolean
}

export interface MenuItemState {
  readonly highlighted: boolean
  readonly disabled: boolean
}

/** What an item does on activation (its own state first, then `select`). */
interface Activation {
  readonly activate?: ((a: MenuActivation) => void) | undefined
  readonly onSelect?: ((details: MenuSelectDetails) => void) | undefined
}

/** A menubar hosting a root level (add-menubar). Internal. */
export interface MenuHost {
  readonly parentKind: MenuParentKind
  readonly host?: MenuTreeHost | undefined
  /** The bar's roving tabindex for this trigger. */
  readonly tabIndex?: () => number | undefined
  /** The bar's item key for this trigger. */
  readonly key?: () => CollectionKey | undefined
}

/** Provided by a menubar around its menus (add-menubar). Internal. */
export const MENU_HOST = new InjectionToken<MenuHost>("rind-ui.menu-host")

type View = ReturnType<Service<typeof menuMachine>["view"]>

/** One level of a menu tree: internal (a context menu builds its root level from it). */
export interface MenuLevel {
  readonly service: () => Service<typeof menuMachine>
  readonly send: Service<typeof menuMachine>["send"]
  readonly view: Signal<View>
  readonly levelId: MenuLevelId
  readonly level: "root" | "submenu"
  readonly props: () => MenuProps
  readonly tree: MenuTree
  readonly keepMounted: () => boolean
  readonly registry: ItemRegistry
  readonly activations: Map<CollectionKey, Activation>
  readonly submenus: Map<CollectionKey, () => void>
  readonly hoverIntent: HoverIntent
  readonly trigger: WritableSignal<HTMLElement | null>
  readonly contentMounted: WritableSignal<boolean>
  /** The stack's metadata for this layer, followed while open. */
  readonly meta: Signal<LayerMeta | undefined>
  /** A submenu's content is named by its trigger item. */
  readonly labelledBy?: string | undefined
  readonly inMenubar: boolean
  /** A context menu: the trigger is a region. */
  readonly region?: boolean | undefined
}

/** The level a part belongs to. Internal. */
export const MENU_LEVEL = new InjectionToken<MenuLevel>("rind-ui.menu-level")

function injectLevel(part: string): MenuLevel {
  const level = inject(MENU_LEVEL, { optional: true })
  if (!level) throw new Error(`rindMenu${part} must be inside rindMenuRoot`)
  return level
}

const isOpen = (level: MenuLevel) => level.view().matches("open")

/** The level's connect. Internal. */
export function menuApi(
  level: MenuLevel,
  env: ReturnType<typeof injectEnvironment>,
  extra: { dir?: "ltr" | "rtl" } = {},
) {
  const view = level.view()
  const props = level.props()
  return menuConnect(
    {
      instance: level.levelId,
      level: level.level,
      open: view.matches("open"),
      modal: props.modal !== false,
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      collection: props.collection,
      highlightedKey: view.context.highlightedKey,
      highlightSource: view.context.highlightSource,
      typingAhead: () => {
        const t = level.service().getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (props.typeaheadTimeout ?? 1000)
      },
      contentMounted: level.contentMounted(),
      labelledBy: level.labelledBy,
      meta: level.meta(),
      manual: menuPositioning(props).mode === "manual",
      inMenubar: level.inMenubar,
      region: level.region,
      ...extra,
    },
    level.send,
    env,
  )
}

/** A level's options, shared by Root, Submenu and a context menu's Root. Internal. */
export interface MenuLevelOptions {
  readonly loop: boolean | undefined
  readonly focusableWhenDisabled: boolean | undefined
  readonly typeaheadTimeout: number | undefined
  readonly positioning: PositioningProps | undefined
  readonly submenuOpenDelay: number | undefined
  readonly submenuGraceTimeout: number | undefined
}

/** The level options as inputs. Internal. */
@Directive()
export abstract class MenuLevelInputs {
  /** Arrow navigation wraps from the last item to the first and back. Default: true. */
  readonly loop = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Disabled items stay reachable by navigation (they still cannot be activated). Default: true. */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
  readonly typeaheadTimeout = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning). */
  readonly positioning = input<PositioningProps>()
  /** Milliseconds the pointer rests on a submenu trigger before it opens. Default: 100. */
  readonly submenuOpenDelay = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** Milliseconds the pointer may rest inside the grace area towards an open submenu before it closes. Default: 300. */
  readonly submenuGraceTimeout = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** @internal */
  protected options(): MenuLevelOptions {
    return {
      loop: this.loop(),
      focusableWhenDisabled: this.focusableWhenDisabled(),
      typeaheadTimeout: this.typeaheadTimeout(),
      positioning: this.positioning(),
      submenuOpenDelay: this.submenuOpenDelay(),
      submenuGraceTimeout: this.submenuGraceTimeout(),
    }
  }
}

/**
 * One level's service, its items, its tree registration and its registries: internal. Call in
 * a constructor.
 */
export function injectMenuLevelService(input: {
  readonly level: "root" | "submenu"
  /** Read lazily: a menubar's menu knows it once its `value` input is set. */
  readonly levelId: () => MenuLevelId
  readonly parentLevel?: MenuLevelId | undefined
  readonly tree: MenuTree
  readonly trigger: Signal<HTMLElement | null>
  readonly options: () => MenuLevelOptions
  readonly controllable?: () => Pick<MenuProps, "open" | "defaultOpen" | "onOpenChange" | "modal">
  /** One per tree: a parent level sees its submenu's transit (the grace area). */
  readonly hoverIntent?: HoverIntent | undefined
  /** A context menu's root level. */
  readonly region?: () => Pick<MenuProps, "onAnchorChange">
}) {
  const env = injectEnvironment(announcerCapability, layoutCapability)
  const parent = injectParentLayer()
  const { collection: registered, registry } = injectCollectionItems()
  const hoverIntent = input.hoverIntent ?? domHoverIntent(env)
  const menuEnv = withCapabilities(env, {
    position: domPositioning(env),
    hoverIntent,
    menuTree: input.tree,
  })
  const activations = new Map<CollectionKey, Activation>()
  const submenus = new Map<CollectionKey, () => void>()
  let ids: MenuProps["ids"] | undefined
  const props = (): MenuProps => {
    const o = input.options()
    if (!ids) {
      const m = menuIds(input.levelId())
      ids = { list: m.content, item: m.item }
    }
    return {
      ...(input.region ? { region: true, onAnchorChange: input.region().onAnchorChange } : {}),
      ...input.controllable?.(),
      collection: registered() ?? EMPTY,
      strategy: "roving",
      ids,
      loop: o.loop ?? true,
      focusableWhenDisabled: o.focusableWhenDisabled ?? true,
      typeaheadTimeout: o.typeaheadTimeout,
      positioning: o.positioning,
      submenuOpenDelay: o.submenuOpenDelay,
      submenuGraceTimeout: o.submenuGraceTimeout,
      level: input.level,
      levelId: input.levelId(),
      parentLevel: input.parentLevel,
      parent: parent(),
      getTrigger: () => untracked(input.trigger),
      onActivate: (a) => {
        const entry = activations.get(a.key)
        if (!entry) return true
        entry.activate?.(a)
        let cancelled = false
        const blocked = focusCalls(() =>
          entry.onSelect?.({
            key: a.key,
            kind: a.kind,
            modality: a.modality,
            cancel: () => {
              cancelled = true
            },
          }),
        )
        // A modal menu keeps the page inert until it closes: a focus move `select` made
        // outside (an editor) was refused, so it is made again once the menu is gone.
        if (blocked && !cancelled) {
          env.scheduler.requestAnimationFrame(() => {
            if (blocked.isConnected && !blocked.closest("[inert]")) blocked.focus()
          })
        }
        return !cancelled
      },
      openSubmenu: (key) => {
        const open = submenus.get(key)
        open?.()
        return open !== undefined
      },
    }
  }
  const { service, send, view } = injectMachine(menuMachine, props, menuEnv)
  const meta = injectLayerMeta(
    () => view().matches("open"),
    () => menuLayerId(input.levelId()),
  )
  return { service, send, view, props, registry, activations, submenus, hoverIntent, meta }
}

/** The changeEmitter of a menu's own details type (its reasons are the menu's). */
function openEmitter(
  details: { emit(e: MenuChangeEvent): void },
  change: { emit(v: boolean): void },
) {
  return (value: boolean, d: MenuChangeDetails) => {
    let cancelled = false
    details.emit({
      value,
      details: {
        ...d,
        cancel() {
          cancelled = true
          d.cancel()
        },
      },
    })
    if (!cancelled) change.emit(value)
  }
}

/**
 * A menu of actions: `<ng-container rindMenuRoot>` with a Trigger and, usually in
 * `<ng-template rindMenuPortal>`, a Positioner holding the Content and its items.
 */
@Directive({
  selector: "[rindMenuRoot]",
  exportAs: "rindMenuRoot",
  providers: [{ provide: MENU_LEVEL, useFactory: () => inject(forwardRef(() => MenuRoot)).level }],
})
export class MenuRoot extends MenuLevelInputs {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id = input<string>()
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true: everything outside is inert and an outside press only closes the menu. */
  readonly modal = input(true, { transform: booleanAttribute })
  /** Positioner and content stay rendered (hidden) while closed. */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  readonly openChangeDetails = output<MenuChangeEvent>()
  /** The accepted visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()

  /** @internal */
  readonly level: MenuLevel
  /** The menu's state, for the template (`#m="rindMenuRoot"`, `m.state()`). */
  readonly state: Signal<MenuState>

  constructor() {
    super()
    const levelId = menuLevelId(injectRootId(() => this.id())())
    const host = inject(MENU_HOST, { optional: true })
    const tree = createMenuTree({
      ...(host ? { parentKind: host.parentKind } : {}),
      ...(host?.host ? { host: host.host } : {}),
    })
    const trigger = signal<HTMLElement | null>(null)
    const onOpenChange = openEmitter(this.openChangeDetails, this.openChange)
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
    })
    this.level = {
      ...s,
      levelId,
      level: "root",
      tree,
      keepMounted: () => this.keepMounted(),
      trigger,
      contentMounted: signal(false),
      inMenubar: host?.parentKind === "menubar",
    }
    this.state = computed(() => ({ open: s.view().matches("open") }))
  }

  /** Opens it. */
  show(): void {
    this.level.send({ type: "OPEN" })
  }
  /** Closes it. */
  hide(): void {
    this.level.send({ type: "CLOSE" })
  }
}

/** Keeps the part's element as the level's trigger while rendered (positioning, the portal). */
function injectTriggerElement(target: WritableSignal<HTMLElement | null>, el: Element) {
  if (inject(PLATFORM_ID) !== "browser") return
  target.set(el instanceof HTMLElement ? el : null)
  inject(DestroyRef).onDestroy(() => {
    if (untracked(target) === el) target.set(null)
  })
}

/**
 * Opens and closes the menu: `<button rindMenuTrigger>` (in a menubar, the bar's own item,
 * a `<div>`).
 */
@Directive({ selector: "[rindMenuTrigger]", exportAs: "rindMenuTrigger" })
export class MenuTrigger {
  readonly disabled = input(false, { transform: booleanAttribute })
  constructor() {
    wireMenuTrigger(injectLevel("Trigger"), () => this.disabled())
  }
}

/** A menu trigger's press, focus and props on this element (a menubar's trigger too). Internal. */
export function wireMenuTrigger(level: MenuLevel, disabled: () => boolean): void {
  const host = inject(MENU_HOST, { optional: true })
  const env = injectEnvironment()
  const el: Element = inject(ElementRef).nativeElement
  const tag = el.tagName.toLowerCase()
  if (inject(PLATFORM_ID) === "browser") {
    // The modality tracker needs a subscriber while the trigger is rendered.
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  const press = injectPress({
    env,
    send: (e) => {
      if (e.type !== "PRESS") return
      // A menubar opens its menus itself (one open menu per bar).
      const key = host?.key?.()
      if (level.inMenubar && key !== undefined) level.tree.parentPress(key, e.modality)
      else untracked(() => menuApi(level, env)).pressTrigger(e.modality)
    },
    disabled: () => disabled(),
    // A label's forwarded click focuses the trigger and never opens the menu.
    labelActivation: "focus",
  })
  injectTriggerElement(level.trigger, el)
  bindProps(
    () =>
      joinHandlers(
        menuApi(level, env).trigger({
          focused: focused(),
          modality: modality(),
          pressed: press.pressed(),
          tag,
          disabled: disabled(),
          tabIndex: host?.tabIndex?.(),
        }),
        press.props,
        { onFocus: () => focused.set(true), onBlur: () => focused.set(false) },
      ),
    { owns: ["disabled"] },
  )
}

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
function injectTriggerDir(level: MenuLevel): Signal<"ltr" | "rtl" | undefined> {
  const env = injectEnvironment()
  const dir = signal<"ltr" | "rtl" | undefined>(undefined)
  const ready = injectRendered()
  effect(() => {
    if (!ready() || !isOpen(level)) return
    dir.set(elementDir(level.trigger(), env.locale.dir()))
  })
  return dir
}

/** Places the content against the trigger: `<div rindMenuPositioner>`. */
@Directive({ selector: "[rindMenuPositioner]", exportAs: "rindMenuPositioner" })
export class MenuPositioner {
  constructor() {
    const level = injectLevel("Positioner")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const dir = injectTriggerDir(level)
    // It holds the content: it stays while the content's exit animations run.
    const presence = injectPresence(() => isOpen(level), el, {
      keepMounted: () => level.keepMounted(),
      subtree: () => true,
    })
    bindProps(() => {
      if (!presence.mounted()) return absentProps("menu", level.levelId)
      const d = dir()
      return {
        ...menuApi(level, env, d ? { dir: d } : {}).positioner(),
        hidden: !isOpen(level) && level.keepMounted(),
      }
    })
  }
}

/** Whether the Content around a part is rendered (absent: its parts are absent too). */
const MENU_CONTENT = new InjectionToken<Signal<boolean>>("rind-ui.menu-content")

/**
 * The part's props while its Content is rendered, else absent: React unmounts the parts of a
 * closed menu, and their stale state (a highlight) must not stay on the page.
 */
function injectPresent(level: MenuLevel): (props: () => PartProps) => () => PartProps {
  const present = inject(MENU_CONTENT, { optional: true })
  return (props) => () => (present && !present() ? absentProps("menu", level.levelId) : props())
}

/** The menu: `<div rindMenuContent>`. Layers opened from it (submenus, dialogs) are its children. */
@Directive({
  selector: "[rindMenuContent]",
  exportAs: "rindMenuContent",
  providers: [
    {
      provide: MENU_CONTENT,
      useFactory: () => inject(forwardRef(() => MenuContent)).present,
    },
    {
      provide: LAYER,
      useFactory: () => {
        const level = injectLevel("Content")
        return layerProvider(
          () => menuLayerId(level.levelId),
          () => "menu",
        )
      },
    },
  ],
})
export class MenuContent {
  /** @internal */
  readonly present: Signal<boolean>
  constructor() {
    const level = injectLevel("Content")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const presence = injectPresence(() => isOpen(level), el, {
      keepMounted: () => level.keepMounted(),
    })
    this.present = presence.mounted
    let naming: { label?: string; labelledBy?: string } = {}
    const { statics } = bindProps(
      () => {
        if (!presence.mounted()) return absentProps("menu", level.levelId)
        const open = isOpen(level)
        const exiting = !open && presence.state() === "exiting"
        return {
          ...menuApi(level, env).content(naming),
          hidden: !open && !exiting && level.keepMounted(),
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
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = injectRendered()
    effect((onCleanup) => {
      const mounted = ready() && presence.mounted()
      untracked(() => {
        level.contentMounted.set(mounted)
        if (mounted) onCleanup(() => level.contentMounted.set(false))
      })
    })
    // Any other element directly inside the menu is presentational for the menu role.
    afterEveryRender({
      write: () => {
        for (const child of Array.from(el.children)) {
          if (
            !child.hasAttribute("data-scope") &&
            !child.hasAttribute("role") &&
            !child.matches(INTERACTIVE)
          ) {
            child.setAttribute("role", "none")
          }
        }
      },
    })
  }
}

@Directive({ selector: "[rindMenuArrow]", exportAs: "rindMenuArrow" })
export class MenuArrow {
  constructor() {
    const level = injectLevel("Arrow")
    const env = injectEnvironment()
    const present = injectPresent(level)
    bindProps(present(() => menuApi(level, env).arrow()))
  }
}

/** The checked state of a checkbox or radio item, for its indicator. */
const MENU_ITEM = new InjectionToken<{ readonly on: Signal<boolean> }>("rind-ui.menu-item")

/** Registers an item and its activation with the level; the item's key. Call in a constructor. */
function injectItem(
  level: MenuLevel,
  item: () => { value?: string | undefined; textValue?: string | undefined; disabled: boolean },
  activation: Activation,
): Signal<CollectionKey> {
  const el: Element = inject(ElementRef).nativeElement
  const generated = inject(RindIds).next()
  const key = computed(() => toKey(item().value ?? generated))
  injectRegisterItem(
    level.registry,
    () => ({ key: key(), textValue: item().textValue, disabled: item().disabled }),
    el,
  )
  effect((onCleanup) => {
    const k = key()
    untracked(() => level.activations.set(k, activation))
    onCleanup(() => level.activations.delete(k))
  })
  return key
}

/** The common inputs of an item. */
@Directive()
abstract class ItemBase {
  /** The item's key (default: generated). */
  readonly value = input<string>()
  /** Typeahead text (default: the text content). */
  readonly textValue = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  /**
   * The item was activated; `details.cancel()` keeps the menu open. Not `select`: a native
   * `select` event (an input's text selection) bubbles to the item.
   */
  readonly itemSelect = output<MenuSelectDetails>()
  /** The item's state, for the template. */
  state!: Signal<MenuItemState>
}

/**
 * An action: `<div rindMenuItem>`, or a link item `<a rindMenuItem href="/docs">` (it
 * navigates, through the provider's router when there is one).
 */
@Directive({ selector: "[rindMenuItem]", exportAs: "rindMenuItem" })
export class MenuItem extends ItemBase {
  /** Default true: activating the item closes the menu tree. */
  readonly closeOnSelect = input(true, { transform: booleanAttribute })
  /** A link item (on an `<a>`). */
  readonly href = input<Href>()
  /** The link's `target`; a target other than `_self` leaves navigation to the browser. */
  readonly target = input<string>()
  /** The link's `rel`. */
  readonly rel = input<string>()
  /** The link's `download`: `true` or a file name; the browser downloads instead of navigating. */
  readonly download = input<boolean | string | undefined, boolean | string | undefined>(undefined, {
    transform: (v) => (v === "" ? true : v),
  })
  /** Passed unchanged to the router's `navigate`. */
  readonly routerOptions = input<RouterOptions>()

  constructor() {
    super()
    const level = injectLevel("Item")
    const env = injectEnvironment()
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    const key = injectItem(
      level,
      () => ({ value: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      { onSelect: (d) => this.itemSelect.emit(d) },
    )
    this.state = computed(() => ({
      highlighted: level.view().context.highlightedKey === key(),
      disabled: this.disabled(),
    }))
    // Unknown on the server and while hydrating, so both renders agree on data-external.
    const origin = signal<string | undefined>(undefined)
    if (inject(PLATFORM_ID) === "browser") afterNextRender(() => origin.set(location.origin))
    const present = injectPresent(level)
    bindProps(
      present(() => {
        const api = menuApi(level, env)
        const link = this.href() !== undefined
        const linkPart = link
          ? linkProps(
              {
                href: this.href(),
                target: this.target(),
                rel: this.rel(),
                download: this.download(),
                routerOptions: this.routerOptions(),
                disabled: this.disabled(),
                focusableWhenDisabled: true,
                origin: origin(),
                tag,
                onActivate: (a) => {
                  if (a.disposition === "same-tab") {
                    untracked(() => menuApi(level, env)).activateLink(
                      untracked(key),
                      a.modality,
                      untracked(this.closeOnSelect),
                    )
                  }
                },
              },
              env,
            )
          : {}
        // The menu owns the role, focus and highlight; the link part only its navigation.
        const { role: _role, tabindex: _tabindex, ...navigation } = linkPart
        return joinHandlers(
          api.item(key(), {
            kind: link ? "link-item" : "item",
            disabled: this.disabled(),
            closeOnSelect: this.closeOnSelect(),
          }),
          navigation,
        )
      }),
      { owns: ["value", "textvalue", "disabled", "closeonselect", "href", "target", "rel"] },
    )
  }
}

/** A toggled option: `<div rindMenuCheckboxItem [(checked)]>`; the menu stays open. */
@Directive({
  selector: "[rindMenuCheckboxItem]",
  exportAs: "rindMenuCheckboxItem",
  providers: [{ provide: MENU_ITEM, useExisting: forwardRef(() => MenuCheckboxItem) }],
})
export class MenuCheckboxItem extends ItemBase {
  /** Controlled checked state (`[(checked)]`). */
  readonly checked = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Initial checked state while uncontrolled. Default: false. */
  readonly defaultChecked = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default false: the menu stays open while options are toggled. */
  readonly closeOnSelect = input(false, { transform: booleanAttribute })
  /** The accepted checked state, for `[(checked)]`. */
  readonly checkedChange = output<boolean>()
  /** @internal */
  readonly on: Signal<boolean>

  constructor() {
    super()
    const level = injectLevel("CheckboxItem")
    const env = injectEnvironment()
    const toggle = injectMachine(toggleMachine, () => ({
      pressed: this.checked(),
      defaultPressed: this.defaultChecked(),
      onPressedChange: (p: boolean) => this.checkedChange.emit(p),
    }))
    this.on = computed(() => toggle.view().values.pressed === true)
    const key = injectItem(
      level,
      () => ({ value: this.value(), textValue: this.textValue(), disabled: this.disabled() }),
      {
        onSelect: (d) => this.itemSelect.emit(d),
        activate: (a) =>
          toggle.send({
            type: "PRESS",
            modality: a.modality,
            pointerType: a.modality === "pointer" ? "mouse" : a.modality,
            shiftKey: false,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
          }),
      },
    )
    this.state = computed(() => ({
      highlighted: level.view().context.highlightedKey === key(),
      disabled: this.disabled(),
    }))
    const present = injectPresent(level)
    bindProps(
      present(() =>
        menuApi(level, env).item(key(), {
          kind: "checkbox-item",
          disabled: this.disabled(),
          closeOnSelect: this.closeOnSelect(),
          checked: this.on(),
        }),
      ),
      { owns: ["value", "textvalue", "disabled", "closeonselect", "checked", "defaultchecked"] },
    )
  }
}

const RADIO_GROUP = new InjectionToken<MenuRadioGroup>("rind-ui.menu-radio-group")

/** One choice among radio items: `<div rindMenuRadioGroup [(value)]>`. */
@Directive({
  selector: "[rindMenuRadioGroup]",
  exportAs: "rindMenuRadioGroup",
  providers: [{ provide: RADIO_GROUP, useExisting: forwardRef(() => MenuRadioGroup) }],
})
export class MenuRadioGroup {
  /** Controlled selected value (`[(value)]`). */
  readonly value = input<string | null>()
  /** Initial selected value while uncontrolled. Default: null. */
  readonly defaultValue = input<string | null>()
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The accepted value, for `[(value)]`. */
  readonly valueChange = output<string | null>()
  /** @internal */
  readonly selected: Signal<string | null>
  /** @internal */
  readonly choose: (value: string) => void

  constructor() {
    const level = injectLevel("RadioGroup")
    const env = injectEnvironment()
    const group = injectMachine(menuRadioGroupMachine, () => ({
      value: this.value(),
      defaultValue: this.defaultValue(),
      onValueChange: (v: string | null) => this.valueChange.emit(v),
      disabled: this.disabled(),
    }))
    this.selected = computed(() => group.view().values.value ?? null)
    this.choose = (v) => group.send({ type: "SELECT", value: v })
    const present = injectPresent(level)
    bindProps(
      present(() => menuApi(level, env).radioGroup({ disabled: this.disabled() })),
      {
        owns: ["disabled", "defaultvalue"],
      },
    )
  }
}

/** A radio choice: `<div rindMenuRadioItem value="dark">`, inside a RadioGroup. */
@Directive({
  selector: "[rindMenuRadioItem]",
  exportAs: "rindMenuRadioItem",
  providers: [{ provide: MENU_ITEM, useExisting: forwardRef(() => MenuRadioItem) }],
})
export class MenuRadioItem extends ItemBase {
  /** Default false. */
  readonly closeOnSelect = input(false, { transform: booleanAttribute })
  /** @internal */
  readonly on: Signal<boolean>

  constructor() {
    super()
    const level = injectLevel("RadioItem")
    const env = injectEnvironment()
    const group = inject(RADIO_GROUP, { optional: true })
    if (!group) throw new Error("rindMenuRadioItem must be inside rindMenuRadioGroup")
    const disabled = computed(() => this.disabled() || group.disabled())
    const value = () => {
      const v = this.value()
      if (v === undefined) throw new Error("rindMenuRadioItem needs a `value`")
      return v
    }
    this.on = computed(() => group.selected() === value())
    const key = injectItem(
      level,
      () => ({ value: value(), textValue: this.textValue(), disabled: disabled() }),
      {
        onSelect: (d) => this.itemSelect.emit(d),
        activate: () => group.choose(untracked(value)),
      },
    )
    this.state = computed(() => ({
      highlighted: level.view().context.highlightedKey === key(),
      disabled: disabled(),
    }))
    const present = injectPresent(level)
    bindProps(
      present(() =>
        menuApi(level, env).item(key(), {
          kind: "radio-item",
          disabled: disabled(),
          closeOnSelect: this.closeOnSelect(),
          checked: this.on(),
        }),
      ),
      { owns: ["value", "textvalue", "disabled", "closeonselect"] },
    )
  }
}

/** A checked mark: `<span rindMenuItemIndicator>`, rendered while its item is checked. */
@Directive({ selector: "[rindMenuItemIndicator]", exportAs: "rindMenuItemIndicator" })
export class MenuItemIndicator {
  /** Rendered while unchecked too (hidden by CSS on `data-state`). */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  constructor() {
    const level = injectLevel("ItemIndicator")
    const env = injectEnvironment()
    const item = inject(MENU_ITEM, { optional: true })
    if (!item) throw new Error("rindMenuItemIndicator must be inside a checkbox or radio item")
    const present = injectPresent(level)
    bindProps(
      present(() => {
        const checked = item.on()
        if (!checked && !this.keepMounted()) return absentProps("menu", level.levelId)
        return menuApi(level, env).itemIndicator(checked)
      }),
      { owns: ["keepmounted"] },
    )
  }
}

@Directive({ selector: "[rindMenuItemText]", exportAs: "rindMenuItemText" })
export class MenuItemText {
  constructor() {
    const level = injectLevel("ItemText")
    const env = injectEnvironment()
    const present = injectPresent(level)
    bindProps(present(() => menuApi(level, env).itemText()))
  }
}

const GROUP = new InjectionToken<{
  readonly labelId: string
  readonly labelled: WritableSignal<boolean>
}>("rind-ui.menu-group")

/** A group of items: `<div rindMenuGroup>`, named by its GroupLabel. */
@Directive({
  selector: "[rindMenuGroup]",
  exportAs: "rindMenuGroup",
  providers: [
    {
      provide: GROUP,
      useFactory: () => ({ labelId: `${inject(RindIds).next()}-label`, labelled: signal(false) }),
    },
  ],
})
export class MenuGroup {
  constructor() {
    const level = injectLevel("Group")
    const env = injectEnvironment()
    const group = inject(GROUP, { self: true })
    const present = injectPresent(level)
    bindProps(
      present(() => menuApi(level, env).group(group.labelled() ? group.labelId : undefined)),
    )
  }
}

@Directive({ selector: "[rindMenuGroupLabel]", exportAs: "rindMenuGroupLabel" })
export class MenuGroupLabel {
  constructor() {
    const level = injectLevel("GroupLabel")
    const env = injectEnvironment()
    const group = inject(GROUP, { optional: true })
    if (!group) throw new Error("rindMenuGroupLabel must be inside rindMenuGroup")
    if (inject(PLATFORM_ID) === "browser") {
      afterNextRender(() => group.labelled.set(true))
      inject(DestroyRef).onDestroy(() => group.labelled.set(false))
    }
    const present = injectPresent(level)
    bindProps(present(() => menuApi(level, env).groupLabel(group.labelId)))
  }
}

@Directive({ selector: "[rindMenuSeparator]", exportAs: "rindMenuSeparator" })
export class MenuSeparator {
  /** Default: perpendicular to the menu (horizontal in a vertical menu). */
  readonly orientation = input<"horizontal" | "vertical">()
  constructor() {
    const level = injectLevel("Separator")
    const env = injectEnvironment()
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    const present = injectPresent(level)
    bindProps(
      present(() => menuApi(level, env).separator({ orientation: this.orientation(), tag })),
      {
        owns: ["orientation"],
      },
    )
  }
}

const SUBMENU = new InjectionToken<MenuSubmenu>("rind-ui.menu-submenu")

/**
 * A nested menu: `<ng-container rindMenuSubmenu>` inside a Content, holding a SubmenuTrigger
 * (an item of this level) and its own Positioner and Content.
 */
@Directive({
  selector: "[rindMenuSubmenu]",
  exportAs: "rindMenuSubmenu",
  providers: [
    { provide: SUBMENU, useExisting: forwardRef(() => MenuSubmenu) },
    { provide: MENU_LEVEL, useFactory: () => inject(forwardRef(() => MenuSubmenu)).level },
  ],
})
export class MenuSubmenu extends MenuLevelInputs {
  /** @internal */
  readonly parent: MenuLevel
  /** @internal */
  readonly level: MenuLevel
  /** @internal */
  readonly key: CollectionKey
  /** @internal The SubmenuTrigger's `disabled`: the expand key never opens a disabled submenu. */
  readonly triggerDisabled = signal(false)

  constructor() {
    super()
    const parent = inject(MENU_LEVEL, { skipSelf: true, optional: true })
    if (!parent) throw new Error("rindMenuSubmenu must be inside rindMenuRoot")
    this.parent = parent
    const levelId = menuLevelId(injectRootId(() => undefined)())
    this.key = toKey(`${levelId}-trigger`)
    const trigger = signal<HTMLElement | null>(null)
    const s = injectMenuLevelService({
      level: "submenu",
      levelId: () => levelId,
      parentLevel: parent.levelId,
      tree: parent.tree,
      trigger,
      options: () => this.options(),
      hoverIntent: parent.hoverIntent,
    })
    parent.submenus.set(this.key, () => {
      if (!untracked(this.triggerDisabled)) s.send({ type: "SUB_OPEN" })
    })
    inject(DestroyRef).onDestroy(() => parent.submenus.delete(this.key))
    this.level = {
      ...s,
      levelId,
      level: "submenu",
      tree: parent.tree,
      keepMounted: parent.keepMounted,
      trigger,
      contentMounted: signal(false),
      labelledBy: menuIds(parent.levelId).item(this.key),
      inMenubar: false,
    }
  }
}

/** Opens its Submenu: `<div rindMenuSubmenuTrigger>`, an item of the enclosing level. */
@Directive({ selector: "[rindMenuSubmenuTrigger]", exportAs: "rindMenuSubmenuTrigger" })
export class MenuSubmenuTrigger {
  /** Typeahead text (default: the text content). */
  readonly textValue = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  /** The item's state, for the template. */
  readonly state: Signal<MenuItemState>

  constructor() {
    const sub = inject(SUBMENU, { optional: true })
    if (!sub) throw new Error("rindMenuSubmenuTrigger must be inside rindMenuSubmenu")
    const child = sub.level
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    injectRegisterItem(
      sub.parent.registry,
      () => ({ key: sub.key, textValue: this.textValue(), disabled: this.disabled() }),
      el,
    )
    effect(() => {
      const d = this.disabled()
      untracked(() => sub.triggerDisabled.set(d))
    })
    const focused = signal(false)
    const hover = child.hoverIntent.triggerProps((e) => child.send(e))
    injectTriggerElement(child.trigger, el)
    this.state = computed(() => ({
      highlighted: sub.parent.view().context.highlightedKey === sub.key,
      disabled: this.disabled(),
    }))
    const present = injectPresent(sub.parent)
    bindProps(
      present(() =>
        joinHandlers(
          menuApi(sub.parent, env).submenuTrigger(sub.key, {
            disabled: this.disabled(),
            focused: focused(),
            open: isOpen(child),
            contentId: menuIds(child.levelId).content,
            contentMounted: child.contentMounted(),
          }),
          this.disabled()
            ? {}
            : { onPointerMove: hover.onPointerMove, onPointerLeave: hover.onPointerLeave },
          {
            onFocus: () => focused.set(true),
            onBlur: () => focused.set(false),
            onClick: (e: MouseEvent) => {
              if (untracked(this.disabled)) {
                e.preventDefault()
                return
              }
              // Pointer, assistive technology, and Enter / Space (the level clicks the item).
              child.send({ type: "TRIGGER_PRESS", modality: env.modality.modality() })
            },
          },
        ),
      ),
      { owns: ["textvalue", "disabled"] },
    )
  }
}

/**
 * The menu's portal (`<ng-template rindMenuPortal>`), with the trigger as its logical parent:
 * the host carries its theme, dir and lang.
 */
@Directive({
  selector: "ng-template[rindMenuPortal]",
  exportAs: "rindMenuPortal",
  providers: PORTAL_PROVIDERS,
})
export class MenuPortal extends PortalBase {
  private readonly owner = injectLevel("Portal")
  protected parent(): Element | null {
    return this.owner.trigger()
  }
}

/** The Menu's parts, for a standalone component's `imports`. */
export const Menu = [
  MenuRoot,
  MenuTrigger,
  MenuPositioner,
  MenuContent,
  MenuArrow,
  MenuItem,
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuItemIndicator,
  MenuItemText,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
  MenuPortal,
] as const
