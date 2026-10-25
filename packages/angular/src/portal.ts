// The layer portal: a host `div[data-rind-portal]` in the target, as React's createPortal
// renders it. Nothing on the server and nothing while hydrating (no mismatch: radix#1386); the
// template is stamped after the first render, its nodes moved into the host.
import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  type EmbeddedViewRef,
  effect,
  inject,
  input,
  PLATFORM_ID,
  Renderer2,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
} from "@angular/core"
import { portalHostAttributes, resolvePortalTarget, syncPortalHost } from "@rind-ui/core"
import { COMPOSITE_HOST } from "./composite-host"
import { SEPARATOR_HOST } from "./separator/separator"

/** A component in a popup is not hosted by the toolbar its trigger sits in (nor its separators). */
const ISOLATED = [
  { provide: COMPOSITE_HOST, useValue: null },
  { provide: SEPARATOR_HOST, useValue: signal(null) },
]

/**
 * What a portal does; a component's own Portal part (a Popover's) subclasses it with its
 * logical parent (the trigger: target resolution and the host's dir, lang and theme).
 */
@Directive()
export abstract class PortalBase {
  /** Where to render (default: resolved from the logical parent, then `body`). */
  readonly container = input<Element | ShadowRoot | null>()
  /**
   * Keeps the host's `dir`, `lang` and theme in step with the logical parent as they change;
   * `false` copies them once. Default: true.
   */
  readonly observe = input(true, { transform: booleanAttribute })
  /** The host's classes (the layer's own styling hook). */
  readonly hostClass = input<string>()

  /** The element the content belongs to. */
  protected abstract parent(): Element | null
  /** Whether the host follows the logical parent's changes (a closed tooltip's does not). */
  protected follows(): boolean {
    return this.observe()
  }

  constructor() {
    if (inject(PLATFORM_ID) !== "browser") return
    const template = inject(TemplateRef)
    const container = inject(ViewContainerRef)
    const renderer = inject(Renderer2)
    const mounted = signal(false)
    afterNextRender(() => mounted.set(true))
    let host: HTMLElement | null = null
    let view: EmbeddedViewRef<unknown> | null = null
    let attributes: Record<string, string> = {}
    // The element, not each read of it: a parent read from machine state (an opener) re-runs
    // only when it changes.
    const parentElement = computed(() => this.parent())
    effect((onCleanup) => {
      if (!mounted()) return
      const own = this.container()
      const observe = this.follows()
      // A logical parent set on open (a dialog's opener) moves the host, not the content.
      const logical = parentElement()
      untracked(() => {
        const parent = () => this.parent()
        const target = resolvePortalTarget(logical, own)
        host ??= renderer.createElement("div") as HTMLElement
        host.setAttribute("data-rind-portal", "")
        // After the target's own children; a new target moves the host, the content stays (a
        // re-append would detach the focused element).
        if (host.parentNode !== target) target.appendChild(host)
        if (!view) {
          view = container.createEmbeddedView(template)
          for (const node of view.rootNodes) host.appendChild(node)
        }
        onCleanup(syncPortalHost(host, parent, observe))
      })
    })
    // The first render after mount already has the right attributes, and a logical parent that
    // changes (a dialog's opener, set on open) is followed at once, without a remount.
    effect(() => {
      if (!mounted()) return
      const cls = this.hostClass()
      untracked(() => {
        if (!host) return
        const next = portalHostAttributes(this.parent())
        for (const key of Object.keys(attributes)) if (!(key in next)) host.removeAttribute(key)
        for (const [key, value] of Object.entries(next)) host.setAttribute(key, value)
        attributes = next
        if (cls === undefined) host.removeAttribute("class")
        else host.setAttribute("class", cls)
      })
    })
    inject(DestroyRef).onDestroy(() => {
      view?.destroy()
      host?.remove()
    })
  }
}

/** Renders its template into a host outside the tree: `<ng-template rindPortal>`. */
@Directive({ selector: "ng-template[rindPortal]", exportAs: "rindPortal", providers: ISOLATED })
export class Portal extends PortalBase {
  /** The element the content belongs to (its trigger): target resolution and dir/lang/theme. */
  readonly logicalParent = input<() => Element | null>()
  protected parent(): Element | null {
    return this.logicalParent()?.() ?? null
  }
}

/** The providers a component's own Portal part needs too (the isolation from its trigger's host). */
export const PORTAL_PROVIDERS = ISOLATED
