import {
  afterNextRender,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  Renderer2,
  signal,
} from "@angular/core"
import {
  activateLink,
  focusAttrs,
  type Href,
  type LinkActivation,
  type LinkCurrent,
  type LinkInput,
  linkConnect,
  type RouterOptions,
  warnInteractiveContent,
  warnLinkFallback,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { CONTROL_OVERRIDE } from "../hosted-control"
import { injectRootId } from "../ids"
import { injectHover, injectModality, injectPress } from "../inject-press"
import { injectEnvironment } from "../provider"

export interface LinkState {
  readonly disabled: boolean
  readonly current: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

/** `undefined` stays undefined (the default); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A navigational link: `<a rindLink href="/docs/">Docs</a>`. With a router in the provider's
 * environment (`provideRind({ environment: { router } })`) it navigates on the client. On the
 * same `<a>` as Angular's `routerLink`, the router link navigates: it prevents the click's
 * default, and the part then leaves the click alone.
 */
@Directive({ selector: "[rindLink]", exportAs: "rindLink" })
export class Link {
  /** Typed by `RouterConfig` (augmentable). */
  readonly href = input<Href>()
  readonly target = input<string>()
  readonly rel = input<string>()
  /** Download instead of navigating (the browser handles it); a string names the file. */
  readonly download = input<boolean | string | undefined, boolean | string | undefined>(
    undefined,
    // A bare `download` attribute downloads.
    { transform: (v) => (v === "" ? true : v) },
  )
  readonly ping = input<string>()
  readonly referrerpolicy = input<LinkInput["referrerPolicy"]>()
  readonly hreflang = input<string>()
  /** Passed unchanged to the router's `navigate`. */
  readonly routerOptions = input<RouterOptions>()
  /** No `href`, `aria-disabled`, out of the Tab order (unless `focusableWhenDisabled`). */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Keeps a disabled link in the Tab order (it stays `aria-disabled`). */
  readonly focusableWhenDisabled = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Sets `aria-current` and `data-current`; the link still navigates. */
  readonly current = input<LinkCurrent | undefined, LinkCurrent | "" | undefined>(undefined, {
    transform: (v) => (v === "" ? true : v),
  })
  readonly id = input<string>()
  /** Once per activation that is not disabled or prevented, with where it opened. */
  readonly activate = output<LinkActivation>()

  /** The link's state, for the template. */
  readonly state: () => LinkState

  constructor() {
    const env = injectEnvironment()
    const el: HTMLElement = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    // Composed by another part (a Toolbar's Link, a Breadcrumbs Link): it decides these.
    const control = inject(CONTROL_OVERRIDE, { optional: true, self: true })
    const disabled = () => control?.source.disabled?.() ?? this.disabled()
    const keepsFocus = () =>
      control?.source.focusableWhenDisabled
        ? control.source.focusableWhenDisabled()
        : this.focusableWhenDisabled()
    const ownId = () => (control?.source.id ? control.source.id() : this.id())
    const current = () => (control?.source.current ? control.source.current() : this.current())
    const href = () => (control?.source.href ? control.source.href() : this.href())
    const instance = injectRootId(ownId)
    // Unknown on the server and while hydrating, so both renders agree on data-external.
    const origin = signal<string | undefined>(undefined)
    const focused = signal(false)
    const input_ = computed<LinkInput>(() => ({
      href: href(),
      target: this.target(),
      rel: this.rel(),
      download: this.download(),
      ping: this.ping(),
      referrerPolicy: this.referrerpolicy(),
      hrefLang: this.hreflang(),
      routerOptions: this.routerOptions(),
      disabled: disabled(),
      focusableWhenDisabled: keepsFocus(),
      current: current(),
      onActivate: (details) => this.activate.emit(details),
      origin: origin(),
      tag,
    }))
    const press = injectPress({
      env,
      disabled: () => disabled(),
      send: (e) => {
        // A native anchor activates through its own click; the fallback through the routine.
        if (e.type === "PRESS" && tag !== "a") activateLink(input_(), el, e, env)
      },
    })
    const hover = injectHover({ env, disabled: () => disabled(), send: () => {} })
    const modality = injectModality(env.modality, focused)
    const focus = computed(() => focusAttrs(focused(), modality()))
    this.state = computed<LinkState>(() => ({
      disabled: disabled(),
      current: current() !== undefined && current() !== false,
      pressed: press.pressed(),
      hovered: hover.hovered(),
      focusVisible: focus()["data-focus-visible"] !== undefined,
    }))
    bindProps(
      () => ({
        ...joinHandlers(
          {
            ...linkConnect({ ...input_(), instance: instance() }, env),
            ...focus(),
            "data-pressed": press.pressed() ? "" : undefined,
            "data-hover": hover.hovered() ? "" : undefined,
          },
          press.props,
          hover.props,
          { onFocusIn: () => focused.set(true), onFocusOut: () => focused.set(false) },
        ),
        ...(ownId() === undefined ? {} : { id: ownId() }),
      }),
      {
        owns: [
          "current",
          "disabled",
          "download",
          "focusablewhendisabled",
          "href",
          "hreflang",
          "id",
          "ping",
          "referrerpolicy",
          "rel",
          "target",
        ],
      },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    // A disabled link drops the consumer's click listener (link-navigation "Disabled Links"):
    // a capture listener on the element runs before every listener at the target.
    const destroy = inject(DestroyRef)
    destroy.onDestroy(
      inject(Renderer2).listen(
        el,
        "click",
        (e: Event) => {
          if (disabled()) e.stopImmediatePropagation()
        },
        { capture: true },
      ),
    )
    afterNextRender(() => {
      origin.set(globalThis.location?.origin)
      warnLinkFallback(el)
      warnInteractiveContent(el, "link")
      // The tracker must see the pointerdown before focus, or a click looks like keyboard focus.
      destroy.onDestroy(env.modality.subscribe(() => {}))
    })
  }
}
