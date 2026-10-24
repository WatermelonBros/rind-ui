import {
  type BaseDomEnvironment,
  type Capability,
  DEFAULT_TYPEAHEAD_TIMEOUT,
  directionOf,
  type MessageOverrides,
  type Messages,
  type ProvidedBy,
  resolveMessages,
} from "@rind-ui/core"
import { environmentFor, environmentHolder, type ProviderConfig } from "@rind-ui/core/internal"
import { createSubscriber } from "svelte/reactivity"
import { createContext } from "./context"
import type { IconName, RindIcons } from "./icons"

/**
 * Message types by component scope. Each component declares its own, so provider overrides
 * are checked like the component's `messages` prop:
 *
 * ```ts
 * declare module "@rind-ui/svelte" {
 *   interface RindMessageScopes { dialog: typeof dialogMessages }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: filled by declaration merging, per component
export interface RindMessageScopes {}

export type ScopeMessages<S extends keyof RindMessageScopes> = RindMessageScopes[S] extends Messages
  ? RindMessageScopes[S]
  : never

/** Message overrides by component scope: `{ dialog: { close: "Chiudi" } }`. */
export type ScopedMessages = {
  readonly [S in keyof RindMessageScopes]?: MessageOverrides<ScopeMessages<S>>
}

/** The provider's config, read through a getter so it stays current. */
export const rindContext = createContext<() => ProviderConfig<RindIcons>>("provider")

/**
 * The provider's environment (or a default one, with no provider): the base capabilities plus
 * the on-demand ones named, e.g. `useEnvironment(announcerCapability)`. Call it during
 * component initialisation; it is read once.
 */
export function useEnvironment<const C extends readonly Capability[]>(
  ...capabilities: C
): BaseDomEnvironment & ProvidedBy<C> {
  const config = rindContext.maybe()
  return environmentFor(config?.().env ?? environmentHolder({}), capabilities)
}

/**
 * Locale and direction for a component: its props, then the provider, then the document
 * (updating when `<html lang>` or the browser language changes). Read `.current`.
 */
export function useLocale(
  locale: () => string | undefined,
  dir: () => "ltr" | "rtl" | undefined = () => undefined,
) {
  const source = useEnvironment().locale
  const subscribe = createSubscriber((update) => source.subscribe?.(update))
  return {
    get current() {
      subscribe()
      const own = locale()
      return {
        locale: own ?? source.locale() ?? "en",
        dir: dir() ?? (own ? directionOf(own) : source.dir() === "rtl" ? "rtl" : ("ltr" as const)),
      }
    },
  }
}

/** A component's messages: defaults, then the provider's for its scope, then its prop. */
export function useMessages<S extends keyof RindMessageScopes>(
  scope: S,
  defaults: ScopeMessages<S>,
  own: () => MessageOverrides<ScopeMessages<S>> | undefined = () => undefined,
): () => ScopeMessages<S> {
  const config = rindContext.maybe()
  return () => {
    // The provider's overrides for this scope were checked against ScopeMessages<S> (props).
    const provided = config?.().messages[scope] as MessageOverrides<ScopeMessages<S>> | undefined
    return resolveMessages(defaults, provided, own())
  }
}

/** The typeahead timeout: the component's prop, then the provider, then 1000 ms. */
export function useTypeaheadTimeout(own: () => number | undefined): () => number {
  const config = rindContext.maybe()
  return () => own() ?? config?.().typeaheadTimeout ?? DEFAULT_TYPEAHEAD_TIMEOUT
}

/** The provider's icon component for `name`, if any. */
export function useIcon(name: IconName) {
  const config = rindContext.maybe()
  return () => config?.().icons[name]
}
