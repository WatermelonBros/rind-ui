import {
  afterEveryRender,
  booleanAttribute,
  computed,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
} from "@angular/core"
import {
  announcerCapability,
  type CompositeHost,
  createListCollection,
  layoutCapability,
  type SeparatorOrientation,
  toolbarConnect,
  toolbarIds,
  toolbarMachine,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { Button } from "../button/button"
import { injectCollectionItems } from "../collection-items"
import { COMPOSITE_HOST, injectCompositeHost, injectHostItem } from "../composite-host"
import { CONTROL_OVERRIDE, HostedControl } from "../hosted-control"
import { injectRootId, RindIds } from "../ids"
import { injectMachine } from "../inject-machine"
import { Link } from "../link/link"
import { injectEnvironment } from "../provider"
import { SEPARATOR_HOST } from "../separator/separator"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

/** The toolbar's parts read its connect through the host (groups re-provide it). */
type ToolbarHost = CompositeHost & { readonly api: ReturnType<typeof toolbarConnect> }

function injectToolbar(part: string): ToolbarHost {
  const host = injectCompositeHost()
  if (!host || !("api" in host))
    throw new Error(`rindToolbar${part} must be inside rindToolbarRoot`)
  return host as ToolbarHost // the toolbar's own host object (the only one with `api`)
}

export interface ToolbarState {
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
}

/**
 * A toolbar: `<div rindToolbarRoot aria-label="Formatting">` with `rindToolbarButton`,
 * `rindToolbarLink` and `rindToolbarItem` controls; a Toggle Group or Radio Group inside joins
 * its arrow-key navigation.
 */
@Directive({
  selector: "[rindToolbarRoot]",
  exportAs: "rindToolbarRoot",
  providers: [
    { provide: COMPOSITE_HOST, useFactory: () => inject(forwardRef(() => ToolbarRoot)).host },
    {
      provide: SEPARATOR_HOST,
      useFactory: () => inject(forwardRef(() => ToolbarRoot)).separators,
    },
  ],
})
export class ToolbarRoot {
  readonly orientation = input<"horizontal" | "vertical">("horizontal")
  /** Arrow moves wrap at both ends (default true). */
  readonly loop = input(true, { transform: booleanAttribute })
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Disabled controls stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled = input(true, { transform: booleanAttribute })
  readonly id = input<string>()

  /** @internal */
  readonly host: ToolbarHost
  /** @internal */
  readonly separators: Signal<{
    readonly context: "toolbar"
    readonly defaultOrientation: SeparatorOrientation
  }>
  /** The toolbar's state, for the template (`#t="rindToolbarRoot"`, `t.state()`). */
  readonly state: Signal<ToolbarState>
  private readonly send: ReturnType<typeof injectMachine<typeof toolbarMachine>>["send"]

  constructor() {
    const env = injectEnvironment(announcerCapability, layoutCapability)
    const instance = injectRootId(() => this.id())
    const ids = computed(() => toolbarIds(instance()))
    const { collection: registered, registry } = injectCollectionItems()
    const collection = () => registered() ?? EMPTY
    const { view, send } = injectMachine(
      toolbarMachine,
      () => ({
        collection: collection(),
        strategy: "roving" as const,
        ids: ids(),
        loop: this.loop(),
        // Each control registers as skipped when it is not focusable while disabled.
        focusableWhenDisabled: false,
        orientation: this.orientation(),
        disabled: this.disabled(),
      }),
      env,
    )
    this.send = send
    const api = computed(() =>
      toolbarConnect(
        {
          instance: instance(),
          collection: collection(),
          highlightedKey: view().context.highlightedKey,
          focusWithin: view().matches("focused"),
          pending: registered() === null,
          orientation: this.orientation(),
          disabled: this.disabled(),
          focusableWhenDisabled: this.focusableWhenDisabled(),
        },
        send,
        env,
      ),
    )
    // The server tab stop: the first control whose props apply (document order).
    // ponytail: never reset; it only counts while the controls have not registered.
    let first: string | null = null
    const self = this
    // Getters: the controls read the toolbar's current inputs in their own renders.
    this.host = {
      kind: "toolbar",
      get orientation() {
        return self.orientation()
      },
      get disabled() {
        return self.disabled()
      },
      get focusableWhenDisabled() {
        return self.focusableWhenDisabled()
      },
      register: registry.register,
      itemProps: (item) => api().control(item),
      claimFirst: (id) => {
        first ??= id
        return first === id
      },
      get api() {
        return api()
      },
    }
    this.separators = computed(() => ({
      context: "toolbar" as const,
      defaultOrientation: (this.orientation() === "horizontal"
        ? "vertical"
        : "horizontal") as SeparatorOrientation,
    }))
    this.state = computed(() => ({ orientation: this.orientation(), disabled: this.disabled() }))
    bindProps(() => api().root(), {
      owns: ["disabled", "focusablewhendisabled", "id", "loop", "orientation"],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const el: Element = inject(ElementRef).nativeElement
    // Development: a toolbar needs a name (aria-label or aria-labelledby).
    let warned = false
    afterEveryRender(() => {
      if (process.env.NODE_ENV === "production" || warned) return
      if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
        warned = true
        console.warn(
          `[rind-ui] toolbar: #${el.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    })
  }

  /** Focuses the toolbar's tab stop (for an application shortcut such as Alt+F10). */
  focus(): void {
    this.send({ type: "FOCUS_TOOLBAR" })
  }
}

/** A control's inputs: its id, disabled, and whether it stays focusable while disabled. */
@Directive()
abstract class ToolbarControl {
  readonly id = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Overrides the toolbar's `focusableWhenDisabled` for this control. */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false),
  })

  /**
   * The roving wiring: the element id is the key; disabled from itself, its group or the
   * toolbar; skipped by arrows when not focusable while disabled.
   */
  protected control(part: "button" | "link" | "item") {
    const host = injectToolbar(part === "button" ? "Button" : part === "link" ? "Link" : "Item")
    const generated = `toolbar-control-${inject(RindIds).next()}`
    const el: Element = inject(ElementRef).nativeElement
    const id = () => this.id() ?? generated
    const disabled = () => host.disabled || this.disabled()
    const keepsFocus = () => this.focusableWhenDisabled() ?? host.focusableWhenDisabled
    injectHostItem(host, () => ({ id: id(), skip: disabled() && !keepsFocus() }), el)
    const hosted = inject(CONTROL_OVERRIDE, { optional: true, self: true })
    if (hosted) hosted.source = { disabled, focusableWhenDisabled: keepsFocus, id }
    return {
      host,
      el,
      id,
      disabled,
      keepsFocus,
      roving: () =>
        host.itemProps({ id: id(), disabled: disabled(), first: host.claimFirst(id()) }),
      part: () => host.api.part(part, id()),
    }
  }
}

const hosted = { provide: CONTROL_OVERRIDE, useFactory: () => new HostedControl() }

/** A Button in the toolbar: `<button rindToolbarButton (press)="undo()">Undo</button>`. */
@Directive({
  selector: "[rindToolbarButton]",
  exportAs: "rindToolbarButton",
  providers: [hosted],
  hostDirectives: [
    {
      directive: Button,
      inputs: ["type", "pending", "focusOnPress", "href", "messages"],
      outputs: ["press", "pressStart", "pressEnd"],
    },
  ],
})
export class ToolbarButton extends ToolbarControl {
  constructor() {
    super()
    const c = this.control("button")
    // After the Button's layer (its host directive was created first): these win.
    bindProps(() => ({ ...c.roving(), ...c.part() }), {
      owns: ["disabled", "focusablewhendisabled", "id"],
    })
  }
}

/** A Link in the toolbar: `<a rindToolbarLink href="/help">Help</a>`. */
@Directive({
  selector: "[rindToolbarLink]",
  exportAs: "rindToolbarLink",
  providers: [hosted],
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
export class ToolbarLink extends ToolbarControl {
  constructor() {
    super()
    const c = this.control("link")
    bindProps(
      () => ({
        ...c.roving(),
        ...c.part(),
        // Space activates a link once without scrolling the page (Enter stays native).
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key !== " " || e.defaultPrevented || e.target !== e.currentTarget) return
          e.preventDefault()
          if (!e.repeat) (e.currentTarget as HTMLElement).click()
        },
      }),
      { owns: ["disabled", "focusablewhendisabled", "id"] },
    )
  }
}

export interface ToolbarItemState {
  readonly disabled: boolean
}

const TEXT_TAGS = new Set(["input", "textarea"])

/** Any other control, on your element: `<input rindToolbarItem aria-label="Size">`. */
@Directive({ selector: "[rindToolbarItem]", exportAs: "rindToolbarItem" })
export class ToolbarItem extends ToolbarControl {
  /** The item's state, for the template (`#i="rindToolbarItem"`, `i.state()`). */
  readonly state: Signal<ToolbarItemState>

  constructor() {
    super()
    const c = this.control("item")
    const tag = c.el.tagName.toLowerCase()
    this.state = computed(() => ({ disabled: c.disabled() }))
    bindProps(
      () => ({
        ...c.roving(),
        ...c.part(),
        ...(!c.disabled()
          ? {}
          : c.keepsFocus()
            ? // Focusable while disabled: announced, and a text field takes no input (base-ui#5366).
              { "aria-disabled": "true", ...(TEXT_TAGS.has(tag) ? { readOnly: true } : {}) }
            : { disabled: true }),
        id: c.id(),
      }),
      { owns: ["disabled", "focusablewhendisabled", "id"] },
    )
  }
}

export interface ToolbarGroupState {
  readonly disabled: boolean
}

/** Groups controls (`role="group"`); `disabled` disables every control inside. */
@Directive({
  selector: "[rindToolbarGroup]",
  exportAs: "rindToolbarGroup",
  providers: [
    { provide: COMPOSITE_HOST, useFactory: () => inject(forwardRef(() => ToolbarGroup)).inner },
  ],
})
export class ToolbarGroup {
  /** Disables every control inside the group. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** @internal The same host, disabled for the controls inside (hosted composites included). */
  readonly inner: ToolbarHost
  /** The group's state, for the template (`#g="rindToolbarGroup"`, `g.state()`). */
  readonly state: Signal<ToolbarGroupState>

  constructor() {
    const host = inject(COMPOSITE_HOST, { skipSelf: true, optional: true })
    if (!host || !("api" in host))
      throw new Error("rindToolbarGroup must be inside rindToolbarRoot")
    const toolbar = host as ToolbarHost // the toolbar's own host object (the only one with `api`)
    const groupDisabled = () => toolbar.disabled || this.disabled()
    this.inner = Object.create(toolbar, { disabled: { get: groupDisabled, enumerable: true } })
    this.state = computed(() => ({ disabled: groupDisabled() }))
    bindProps(() => toolbar.api.group(groupDisabled()), { owns: ["disabled"] })
  }
}

/** A divider between controls; perpendicular to the toolbar by default. */
@Directive({ selector: "[rindToolbarSeparator]", exportAs: "rindToolbarSeparator" })
export class ToolbarSeparator {
  /** Default: perpendicular to the toolbar. */
  readonly orientation = input<SeparatorOrientation>()

  constructor() {
    const host = injectToolbar("Separator")
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    bindProps(() => host.api.separator({ orientation: this.orientation(), tag }), {
      owns: ["orientation"],
    })
  }
}

/** The Toolbar's parts, for a standalone component's `imports`. */
export const Toolbar = [
  ToolbarRoot,
  ToolbarButton,
  ToolbarLink,
  ToolbarItem,
  ToolbarGroup,
  ToolbarSeparator,
] as const
