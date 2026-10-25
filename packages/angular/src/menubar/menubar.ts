// Menubar parts (design §7): Root (the bar's service, its item registry and the port to its
// menus), Menu (an ordinary Menu root level hosted by the bar) and Trigger (the menu's trigger
// in menubar mode, plus the bar's roving wiring). Inside a menu, the Menu parts.
import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  InjectionToken,
  inject,
  input,
  isDevMode,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  announcerCapability,
  type CollectionKey,
  createListCollection,
  createMenuTree,
  layoutCapability,
  type MenubarMenus,
  type MenubarOpening,
  type MenubarValueReason,
  type MenuChangeDetails,
  type MenuCloseReason,
  type MenuTreeHost,
  menubarConnect,
  menubarMachine,
  menuIds,
  menuLevelId,
  positioningPresets,
  toKey,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectCollectionItems, injectRegisterItem } from "../collection-items"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import {
  injectMenuLevelService,
  MENU_HOST,
  MENU_LEVEL,
  type MenuHost,
  type MenuLevel,
  MenuLevelInputs,
  type MenuLevelOptions,
  wireMenuTrigger,
} from "../menu/menu"
import { injectEnvironment } from "../provider"

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** One menu level, as the bar drives it. */
interface MenuHandle {
  isOpen(): boolean
  send(event: { type: "TRIGGER_PRESS"; modality: MenubarOpening["modality"] }): void
  send(event: { type: "TRIGGER_KEY"; key: "first" | "last" }): void
  send(event: { type: "CLOSE" } | { type: "TREE.SIBLING_OPENED" }): void
}

/** What a `valueChange` reports besides the value. */
export interface MenubarValueDetails {
  readonly reason: MenubarValueReason
  readonly event: unknown
}

/** What a `valueChangeDetails` output emits. */
export interface MenubarValueEvent {
  readonly value: string | null
  readonly details: MenubarValueDetails
}

export interface MenubarState {
  readonly open: boolean
  readonly orientation: "horizontal" | "vertical"
}

const BAR = new InjectionToken<MenubarRoot>("rind-ui.menubar")

function injectBar(part: string): MenubarRoot {
  const bar = inject(BAR, { optional: true })
  if (!bar) throw new Error(`rindMenubar${part} must be inside rindMenubarRoot`)
  return bar
}

/** The menu's level id: its trigger's element id is the bar item's (ids.item). */
const levelOf = (instance: string, key: string) => `${instance}-menu-${key}`

/** A menubar: `<div rindMenubarRoot aria-label="…">` holding Menus. */
@Directive({
  selector: "[rindMenubarRoot]",
  exportAs: "rindMenubarRoot",
  providers: [{ provide: BAR, useExisting: forwardRef(() => MenubarRoot) }],
})
export class MenubarRoot {
  /** The open menu's value, or null (`[(value)]`). */
  readonly value = input<string | null>()
  readonly defaultValue = input<string | null>()
  readonly orientation = input<"horizontal" | "vertical">("horizontal")
  /** Arrow moves wrap at both ends (default true). */
  readonly loop = input(true, { transform: booleanAttribute })
  /** Default true: passed to every menu. */
  readonly modal = input(true, { transform: booleanAttribute })
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled items stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled = input(true, { transform: booleanAttribute })
  readonly id = input<string>()
  readonly valueChangeDetails = output<MenubarValueEvent>()
  /** The open menu's value, for `[(value)]`. */
  readonly valueChange = output<string | null>()

  /** @internal */
  readonly instance: () => string
  /** @internal */
  readonly api: Signal<ReturnType<typeof menubarConnect>>
  /** @internal */
  readonly send: ReturnType<typeof injectMachine<typeof menubarMachine>>["send"]
  /** @internal */
  readonly registry: ReturnType<typeof injectCollectionItems>["registry"]
  /** @internal */
  readonly handles = new Map<CollectionKey, MenuHandle>()
  /** @internal Closes the bar itself causes: not reported back as MENU_CLOSED. */
  readonly closing = new Set<CollectionKey>()
  /** @internal */
  readonly root: HTMLElement | null
  /** The bar's state, for the template (`#b="rindMenubarRoot"`, `b.state()`). */
  readonly state: Signal<MenubarState>
  private first: CollectionKey | null = null

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const el: Element = inject(ElementRef).nativeElement
    this.root = el instanceof HTMLElement ? el : null
    const { collection: registered, registry } = injectCollectionItems()
    this.registry = registry
    const handles = this.handles
    const closing = this.closing
    // The port to the menus: idempotent (a parent's value may repeat what already happened).
    const menus: MenubarMenus = {
      open(key, how) {
        const h = handles.get(key)
        // A reopened menu reports its next close again (a mark its last close left behind).
        closing.delete(key)
        if (!h || h.isOpen()) return
        if (how.edge) h.send({ type: "TRIGGER_KEY", key: how.edge })
        else h.send({ type: "TRIGGER_PRESS", modality: how.modality })
      },
      close(key, { switching }) {
        const h = handles.get(key)
        if (!h?.isOpen()) return
        // Cleared by the menu's openChange, which may run after this returns; at once when the
        // menu did not close (nothing will be reported), and by the next open otherwise.
        closing.add(key)
        h.send(switching ? { type: "TREE.SIBLING_OPENED" } : { type: "CLOSE" })
        if (h.isOpen()) closing.delete(key)
      },
    }
    const ids = {
      list: () => `${instance()}-menubar`,
      item: (key: CollectionKey) => menuIds(levelOf(instance(), key)).trigger,
    }
    const { view, send } = injectMachine(
      menubarMachine,
      () => {
        const value = this.value()
        const defaultValue = this.defaultValue()
        return {
          collection: registered() ?? EMPTY,
          strategy: "roving" as const,
          ids: { list: ids.list(), item: ids.item },
          loop: this.loop(),
          // Disabled items stay reachable by the bar's arrows and typeahead unless `false`;
          // keyboard switching between open menus skips them either way.
          focusableWhenDisabled: this.focusableWhenDisabled(),
          orientation: this.orientation(),
          modal: this.modal(),
          disabled: this.disabled(),
          menus,
          ...(value !== undefined ? { value } : {}),
          ...(defaultValue !== undefined ? { defaultValue } : {}),
          onValueChange: (v: string | null, d: MenubarValueDetails) => {
            this.valueChangeDetails.emit({ value: v, details: d })
            this.valueChange.emit(v)
          },
        }
      },
      env,
    )
    this.send = send
    const open = computed(() => view().values.value ?? null)
    this.state = computed(() => ({ open: open() !== null, orientation: this.orientation() }))
    const focusWithin = signal(false)
    this.api = computed(() =>
      menubarConnect(
        {
          instance: instance(),
          collection: registered() ?? EMPTY,
          highlightedKey: view().context.highlightedKey,
          focusWithin: focusWithin(),
          pending: registered() === null,
          value: open(),
          orientation: this.orientation(),
          disabled: this.disabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
          modal: this.modal(),
        },
        send,
        env,
      ),
    )
    bindProps(
      () => ({
        ...this.api().root(),
        onFocusIn: () => focusWithin.set(true),
        onFocusOut: (e: FocusEvent) => {
          const target = e.currentTarget as Element
          if (!target.contains(e.relatedTarget as Node | null)) focusWithin.set(false)
        },
      }),
      { owns: ["orientation", "loop", "modal", "disabled", "focusablewhendisabled", "id"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // An initial value (controlled or default) opens its menu once the menus have rendered
    // (their handles register in their own after-render callbacks, which run first).
    afterNextRender(() => {
      if (untracked(open) !== null) send({ type: "VALUE.SYNC" })
      // Development: a menubar needs a name.
      if (!isDevMode()) return
      if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] menubar: #${el.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    })
  }

  /** @internal The first trigger in creation order holds the server tab stop. */
  claimFirst(key: CollectionKey): boolean {
    this.first ??= key
    return this.first === key
  }

  /** Focuses the bar's tab stop (for an application shortcut such as F10). */
  focus(): void {
    this.send({ type: "FOCUS_MENUBAR" })
  }
}

const ENTRY = new InjectionToken<MenubarMenu>("rind-ui.menubar-menu")

/**
 * One menu of the bar: `<ng-container rindMenubarMenu value="file">` with a Trigger and, in
 * `<ng-template rindMenuPortal>`, the Menu's Positioner and Content.
 */
@Directive({
  selector: "[rindMenubarMenu]",
  exportAs: "rindMenubarMenu",
  providers: [
    { provide: ENTRY, useExisting: forwardRef(() => MenubarMenu) },
    { provide: MENU_LEVEL, useFactory: () => inject(forwardRef(() => MenubarMenu)).level },
    { provide: MENU_HOST, useFactory: () => inject(forwardRef(() => MenubarMenu)).host },
  ],
})
export class MenubarMenu extends MenuLevelInputs {
  /** The menu's key in the bar's `value`. */
  readonly value = input.required<string>()
  /** Disables this menu: its trigger never opens it. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Positioner and content stay rendered (hidden) while closed. */
  readonly keepMounted = input(false, { transform: booleanAttribute })

  /** @internal */
  readonly key = computed(() => toKey(this.value()))
  /** @internal */
  readonly host: MenuHost
  /** @internal */
  readonly level: MenuLevel

  constructor() {
    super()
    const bar = injectBar("Menu")
    const key = this.key
    const treeHost: MenuTreeHost = {
      elements: () => (bar.root ? [bar.root] : []),
      navigate: ({ direction }) => {
        if (untracked(bar.orientation) === "vertical") {
          if (direction === "collapse") {
            bar.send({ type: "MENU_NAVIGATE", from: untracked(key), direction })
          }
          return
        }
        const next = direction === "expand" ? "next" : "previous"
        bar.send({ type: "MENU_NAVIGATE", from: untracked(key), direction: next })
      },
      press: (k, modality) => bar.send({ type: "TRIGGER_PRESS", key: k, modality }),
    }
    this.host = { parentKind: "menubar", key, host: treeHost }
    // The level id is the bar's (its trigger's id is the bar item's), known once the inputs are.
    let id: string | undefined
    const levelId = () => {
      id ??= levelOf(untracked(bar.instance), untracked(key))
      return menuLevelId(id)
    }
    const tree = createMenuTree({ parentKind: "menubar", host: treeHost })
    const trigger = signal<HTMLElement | null>(null)
    const onOpenChange = (open: boolean, details: MenuChangeDetails) => {
      // The bar's own closes (switching, its item pressed) are already in its value.
      if (open) return
      if (bar.closing.delete(untracked(key))) return
      bar.send({
        type: "MENU_CLOSED",
        key: untracked(key),
        reason: details.reason as MenuCloseReason,
      })
    }
    const options = (): MenuLevelOptions => {
      const o = this.options()
      return bar.orientation() === "vertical"
        ? { ...o, positioning: { ...positioningPresets.submenu, ...o.positioning } }
        : o
    }
    const s = injectMenuLevelService({
      level: "root",
      levelId,
      tree,
      trigger,
      options,
      controllable: () => ({ onOpenChange, modal: bar.modal() }),
    })
    const keepMounted = () => this.keepMounted()
    this.level = {
      ...s,
      get levelId() {
        return levelId()
      },
      level: "root",
      tree,
      keepMounted,
      trigger,
      contentMounted: signal(false),
      inMenubar: true,
    }
    // The bar's port to this level.
    const handle: MenuHandle = {
      isOpen: () => s.service().getSnapshot().state === "open",
      // Sound: every event the port sends is a menu event.
      send: (event: unknown) => s.send(event as Parameters<typeof s.send>[0]),
    }
    if (inject(PLATFORM_ID) !== "browser") return
    afterNextRender(() => bar.handles.set(untracked(key), handle))
    inject(DestroyRef).onDestroy(() => {
      if (bar.handles.get(untracked(key)) === handle) bar.handles.delete(untracked(key))
    })
  }
}

/** A menu's trigger, an item of the bar: `<div rindMenubarTrigger>`. */
@Directive({ selector: "[rindMenubarTrigger]", exportAs: "rindMenubarTrigger" })
export class MenubarTrigger {
  /** The typeahead text of the bar item. Default: the text content. */
  readonly textValue = input<string>()
  constructor() {
    const bar = injectBar("Trigger")
    const entry = inject(ENTRY, { optional: true })
    if (!entry) throw new Error("rindMenubarTrigger must be inside rindMenubarMenu")
    const el: Element = inject(ElementRef).nativeElement
    const disabled = () => bar.disabled() || entry.disabled()
    wireMenuTrigger(entry.level, disabled)
    injectRegisterItem(
      bar.registry,
      () => ({ key: entry.key(), textValue: this.textValue(), disabled: disabled() }),
      el,
    )
    let first: boolean | undefined
    bindProps(
      () => {
        const key = entry.key()
        first ??= bar.claimFirst(key)
        return bar.api().item({ key, disabled: disabled(), first })
      },
      { owns: ["textvalue"] },
    )
  }
}

/** The Menubar's parts; inside a menu, the Menu's. */
export const Menubar = [MenubarRoot, MenubarMenu, MenubarTrigger] as const
