import {
  afterNextRender,
  DestroyRef,
  ElementRef,
  effect,
  HostAttributeToken,
  inject,
  NgZone,
  PLATFORM_ID,
  Renderer2,
  RendererStyleFlags2,
  untracked,
} from "@angular/core"
import { CRITICAL, type PartProps } from "@rind-ui/core"
import { type AdapterProps, joinHandlers as join, neutralName } from "@rind-ui/core/internal"

declare const process: { env: { NODE_ENV?: string } }

type Props = PartProps
type Handler = (event: Event) => void

const isHandler = (key: string) => /^on[A-Z]/.test(key)

/** A part's own props from several core modules; same-named handlers all run in order. */
// PartProps and AdapterProps are both records of unknown values keyed by strings and CRITICAL;
// only their index signatures are spelled differently.
export const joinHandlers = (...sources: Props[]): Props =>
  join(isHandler, ...(sources as Readonly<AdapterProps>[])) as Props
/** `onPointerDown` → `pointerdown`, `onFocusIn` → `focusin`, `onDblClick` → `dblclick`. */
const eventName = (key: string) => key.slice(2).toLowerCase()
/** Written as DOM properties in the browser (the user's edits stay), as attributes on the server. */
const PROPERTIES: Readonly<Record<string, string>> = {
  value: "value",
  checked: "checked",
  defaultValue: "value",
  defaultChecked: "checked",
}

/** Events whose part handler the consumer's own listener skipped with `preventRindHandler()`. */
const skipped = new WeakSet<Event>()

interface Binder {
  readonly layers: (() => Props)[]
  /** The part's own attributes (its inputs), never the consumer's. */
  readonly owns: Set<string>
  readonly drops: (() => readonly string[])[]
  readonly statics: ReadonlyMap<string, string>
}

export interface BindOptions {
  /**
   * Attributes that are the part's inputs (lowercase, as in the DOM): a static `href="…"` sets
   * Button's input. Angular keeps a static input attribute on the element; the part writes the
   * ones connect produces and removes the others (`orientation="vertical"`), as React renders.
   */
  readonly owns?: readonly string[]
  /** Consumer attributes the part removes while it says so (a decorative separator's name). */
  readonly drop?: () => readonly string[]
}

/** What the binder knows about the element, for the part's development checks. */
export interface Bound {
  /** The consumer's static attributes, as written in the template. */
  readonly statics: ReadonlyMap<string, string>
}
const binders = new WeakMap<Element, Binder>()

/**
 * Applies a part's props (connect output, joined with press/hover/focus handlers) to the host
 * element. Every directive on one element shares one binder: their layers merge in the order
 * the directives were created, later attributes winning and same-named handlers all running.
 *
 * Attributes are written from an `effect`, so the server HTML carries them. Listeners are added
 * after the first render, after the consumer's own template listeners, so the consumer's
 * `(event)` runs first and may call `event.preventRindHandler()` to skip the part's handler.
 * A static attribute the consumer wrote on the element wins over the part's, except those the
 * part `owns`. The binder removes only attributes it wrote itself: another directive's (a
 * router link's `href`) stays.
 */
export function bindProps(props: () => PartProps, options: BindOptions = {}): Bound {
  const el = inject(ElementRef<Element>).nativeElement
  const existing = binders.get(el)
  if (existing) {
    existing.layers.push(props)
    for (const key of options.owns ?? []) existing.owns.add(key)
    if (options.drop) existing.drops.push(options.drop)
    return { statics: existing.statics }
  }

  const renderer = inject(Renderer2)
  const zone = inject(NgZone)
  const browser = inject(PLATFORM_ID) === "browser"
  // The consumer's static attributes, from the template, not the element: a hydrated element
  // already carries the attributes the part wrote on the server. The element's names are a
  // superset; the template answers for each (null: not the consumer's).
  const statics = new Map<string, string>()
  for (const name of el.getAttributeNames()) {
    const value = inject(new HostAttributeToken(name), { optional: true })
    if (value !== null) statics.set(name, value)
  }
  const binder: Binder = {
    layers: [props],
    owns: new Set(options.owns),
    drops: options.drop ? [options.drop] : [],
    statics,
  }
  let dropped = new Set<string>()
  const consumer = (key: string): string | null =>
    binder.owns.has(key) || dropped.has(key) ? null : (statics.get(key) ?? null)
  binders.set(el, binder)
  // ponytail: only client writes count; a server-written attribute the hydrating client no longer
  // produces stays (hydration renders the server's state, so they agree by construction).
  const written = new Set<string>()
  let attrs: Readonly<Record<string, unknown>> = {}
  // The part's own static inputs are its to remove (connect writes the real attributes back):
  // seeded as the previous render's, so the first render drops those connect does not produce.
  for (const key of binder.owns) {
    if (!statics.has(key)) continue
    written.add(key)
    attrs = { ...attrs, [key]: statics.get(key) }
  }
  const handlers = new Map<string, Handler>()
  const listening = new Map<string, () => void>()
  let styles = new Set<string>()
  let ready = false

  const listen = (event: string) => {
    if (listening.has(event)) return
    zone.runOutsideAngular(() => {
      // Capture runs before the consumer's listener: it installs the opt-out on the event.
      const offCapture = renderer.listen(
        el,
        event,
        (e: Event) => {
          Object.assign(e, { preventRindHandler: () => skipped.add(e) })
        },
        { capture: true },
      )
      const offPart = renderer.listen(el, event, (e: Event) => {
        if (skipped.has(e)) return
        // A signal written while Angular renders throws (NG0600): the browser can dispatch
        // events synchronously during a render (focus moves, a click from a test).
        untracked(() => handlers.get(event)?.(e))
      })
      listening.set(event, () => {
        offCapture()
        offPart()
      })
    })
  }

  const warned = new Set<string>()
  const apply = (next: Props) => {
    const critical = (next[CRITICAL] as readonly string[] | undefined) ?? []
    const nextAttrs: Record<string, unknown> = {}
    let style: Readonly<Record<string, unknown>> | undefined
    handlers.clear()
    const nextDropped = new Set(binder.drops.flatMap((drop) => drop()))
    for (const key of nextDropped) if (statics.has(key)) renderer.removeAttribute(el, key)
    for (const key of dropped) {
      const value = statics.get(key)
      if (!nextDropped.has(key) && value !== undefined) renderer.setAttribute(el, key, value)
    }
    dropped = nextDropped
    for (const own of Object.keys(next)) {
      const key = neutralName(own)
      const value = next[own]
      if (isHandler(key) && typeof value === "function")
        handlers.set(eventName(key), value as Handler)
      else if (key === "style" && value && typeof value === "object") style = value as typeof style
      else nextAttrs[key] = value
    }
    for (const key of Object.keys(attrs)) {
      if (!(key in nextAttrs) && consumer(key) === null) remove(key)
    }
    for (const [key, value] of Object.entries(nextAttrs)) {
      const own = consumer(key)
      if (own !== null) {
        if (
          process.env.NODE_ENV !== "production" &&
          critical.includes(key) &&
          own !== String(value) &&
          !warned.has(key)
        ) {
          warned.add(key)
          console.warn(
            `[rind-ui] ${String(next["data-scope"])}.${String(next["data-part"])}: overriding "${key}" can break its accessibility.`,
          )
        }
        continue
      }
      write(key, value)
    }
    attrs = nextAttrs
    if (!browser) {
      // The server's DOM (domino) drops style values it does not parse (`clip: rect(0 0 0 0)`):
      // the server writes the declarations as one attribute, after the consumer's.
      const own = Object.entries(style ?? {}).filter(([, v]) => v !== undefined && v !== null)
      if (own.length > 0) {
        const css = own.map(([k, v]) => `${k}: ${String(v)}`).join("; ")
        const before = statics.get("style")
        set("style", before ? `${before}; ${css}` : css)
      }
      if (ready) for (const event of handlers.keys()) listen(event)
      return
    }
    const nextStyles = new Set(Object.keys(style ?? {}))
    for (const key of styles) if (!nextStyles.has(key)) renderer.removeStyle(el, key, flags(key))
    for (const [key, value] of Object.entries(style ?? {})) {
      if (value === undefined || value === null) renderer.removeStyle(el, key, flags(key))
      else renderer.setStyle(el, key, String(value), flags(key))
    }
    styles = nextStyles
    if (ready) for (const event of handlers.keys()) listen(event)
  }

  const write = (key: string, value: unknown) => {
    const property = PROPERTIES[key]
    if (property && browser) {
      if (key.startsWith("default")) {
        // Only the initial value: later renders keep what the user typed.
        if (!(key in attrs)) renderer.setProperty(el, property, value)
      } else renderer.setProperty(el, property, value)
      return
    }
    const name = property ?? key
    if (value === undefined || value === null) remove(name)
    else if (typeof value === "boolean" && !/^(aria|data)-/.test(name)) {
      // HTML boolean attributes (disabled, hidden, inert): present or absent, as React renders
      // them; aria-* and data-* keep "true"/"false".
      if (value) set(name, "")
      else remove(name)
    } else set(name, String(value))
  }
  const set = (name: string, value: string) => {
    written.add(name)
    renderer.setAttribute(el, name, value)
  }
  const remove = (name: string) => {
    if (!written.delete(name)) return
    renderer.removeAttribute(el, name)
  }

  effect(() => {
    const layers = binder.layers.map((layer) => layer())
    untracked(() => apply(joinHandlers(...layers)))
  })
  if (browser) {
    afterNextRender(() => {
      ready = true
      for (const event of handlers.keys()) listen(event)
    })
  }
  inject(DestroyRef).onDestroy(() => {
    for (const off of listening.values()) off()
    binders.delete(el)
  })
  return { statics }
}

// Connect's style keys are CSS property names (kebab case, custom properties): `setProperty`.
const flags = (_key: string) => RendererStyleFlags2.DashCase
