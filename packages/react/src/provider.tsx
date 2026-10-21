"use client"

import {
  type Announcer,
  type BaseDomEnvironment,
  baseDomEnvironment,
  type Capability,
  DEFAULT_TYPEAHEAD_TIMEOUT,
  type DomEnvironmentOptions,
  directionOf,
  extendEnvironment,
  type MessageOverrides,
  type Messages,
  type ProvidedBy,
  resolveMessages,
} from "@rind-ui/core"
import {
  type ComponentType,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react"
import type { IconName, RindIcons } from "./icons"

/**
 * Message types by component scope. Each component declares its own, so provider overrides
 * are checked like the component's `messages` prop:
 *
 * ```ts
 * declare module "@rind-ui/react" {
 *   interface RindMessageScopes { dialog: typeof dialogMessages }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: filled by declaration merging, per component
export interface RindMessageScopes {}

type ScopeMessages<S extends keyof RindMessageScopes> = RindMessageScopes[S] extends Messages
  ? RindMessageScopes[S]
  : never

/** Message overrides by component scope: `{ dialog: { close: "Chiudi" } }`. */
export type ScopedMessages = {
  readonly [S in keyof RindMessageScopes]?: MessageOverrides<ScopeMessages<S>>
}

/** The untyped view the provider merges (the typed one is checked at the props). */
type AnyScopedMessages = Readonly<Record<string, Readonly<Record<string, unknown>>>>

export interface RindProviderProps {
  readonly locale?: string
  /** Default: the locale's direction. */
  readonly dir?: "ltr" | "rtl"
  readonly messages?: ScopedMessages
  readonly announcer?: Announcer | "live-region" | "aria-notify"
  /** Typeahead reset delay for every component below (default 1000 ms). */
  readonly typeaheadTimeout?: number
  /** Further environment overrides (platform, reduced motion, nonce, …). */
  readonly environment?: DomEnvironmentOptions
  /** Icon components by name, rendered by indicator parts that got no children. */
  readonly icons?: RindIcons
  readonly children?: ReactNode
}

interface RindConfig {
  readonly locale: string | undefined
  /** Set explicitly at this level or inherited with the same locale. */
  readonly dir: "ltr" | "rtl" | undefined
  readonly messages: AnyScopedMessages
  readonly announcer: RindProviderProps["announcer"]
  readonly typeaheadTimeout: number
  readonly environment: DomEnvironmentOptions
  readonly icons: RindIcons
  readonly env: EnvironmentHolder
}

/**
 * One provider's environment: the base, built with the provider, and each on-demand
 * capability, built the first time a component below asks for it (one announcer, one set of
 * live regions, per provider).
 */
interface EnvironmentHolder {
  readonly base: BaseDomEnvironment
  get(capability: Capability): unknown
}

function environmentHolder(options: DomEnvironmentOptions): EnvironmentHolder {
  const base = baseDomEnvironment(options)
  const built = new Map<Capability, unknown>()
  return {
    base,
    get(capability) {
      if (!built.has(capability)) built.set(capability, capability.create(base, options))
      return built.get(capability)
    },
  }
}

const RindContext = createContext<RindConfig | null>(null)

/**
 * Locale, direction, message overrides, announcer, typeahead timeout and environment for
 * every component below. Nested providers override their parent field by field; a
 * component prop overrides the provider.
 */
export function RindProvider(props: RindProviderProps) {
  const parent = useContext(RindContext)
  const { locale, dir, messages, announcer, typeaheadTimeout, environment, icons, children } = props
  const value = useMemo((): RindConfig => {
    const merged = {
      locale: locale ?? parent?.locale,
      // A new locale without a direction takes the locale's direction, not the parent's.
      dir: dir ?? (locale === undefined ? parent?.dir : undefined),
      // ScopedMessages is a typed view of the same record shape.
      messages: mergeMessages(parent?.messages, messages as AnyScopedMessages | undefined),
      announcer: announcer ?? parent?.announcer,
      typeaheadTimeout: typeaheadTimeout ?? parent?.typeaheadTimeout ?? DEFAULT_TYPEAHEAD_TIMEOUT,
      environment: { ...parent?.environment, ...environment },
      icons: { ...parent?.icons, ...icons },
    }
    const options: DomEnvironmentOptions = {
      ...merged.environment,
      ...(merged.locale === undefined ? {} : { locale: merged.locale }),
      ...(merged.dir === undefined ? {} : { dir: merged.dir }),
      ...(merged.announcer === undefined ? {} : { announcer: merged.announcer }),
    }
    return { ...merged, env: environmentHolder(options) }
  }, [parent, locale, dir, messages, announcer, typeaheadTimeout, environment, icons])
  return <RindContext value={value}>{children}</RindContext>
}

function mergeMessages(
  outer: AnyScopedMessages | undefined,
  inner: AnyScopedMessages | undefined,
): AnyScopedMessages {
  if (!outer) return inner ?? {}
  if (!inner) return outer
  const out: Record<string, Readonly<Record<string, unknown>>> = { ...outer }
  for (const [scope, m] of Object.entries(inner)) out[scope] = { ...outer[scope], ...m }
  return out
}

/**
 * The provider's environment (or a default one, with no provider): the base capabilities plus
 * the on-demand ones named, e.g. `useEnvironment(announcerCapability)`. A machine whose `env`
 * needs a capability that was not named does not type-check.
 */
export function useEnvironment<const C extends readonly Capability[]>(
  ...capabilities: C
): BaseDomEnvironment & ProvidedBy<C> {
  const config = useContext(RindContext)
  const fallback = useMemo(() => (config ? null : environmentHolder({})), [config])
  // Exactly one of the two is set: `fallback` exists whenever there is no provider.
  const holder = config?.env ?? (fallback as EnvironmentHolder)
  // The capability list is a set of module constants per call site: its length never changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the capabilities are the deps
  return useMemo(() => {
    if (capabilities.length === 0) return holder.base as BaseDomEnvironment & ProvidedBy<C>
    const additions = Object.fromEntries(capabilities.map((c) => [c.key, holder.get(c)]))
    // Each `c.key` maps to `c.create`'s result: the shape `ProvidedBy<C>` describes.
    return extendEnvironment(holder.base, additions as ProvidedBy<C>)
  }, [holder, ...capabilities])
}

const noSubscription = () => () => {}

/**
 * Locale and direction for a component: its props, then the provider, then the document
 * (re-rendering when `<html lang>` or the browser language changes).
 */
export function useLocale(locale?: string, dir?: "ltr" | "rtl") {
  const env = useEnvironment()
  const source = env.locale
  const current = useSyncExternalStore(
    source.subscribe ?? noSubscription,
    () => `${source.locale()}|${source.dir()}`,
    () => `${source.locale()}|${source.dir()}`,
  )
  const [envLocale = "en", envDir] = current.split("|")
  return {
    locale: locale ?? envLocale,
    dir: dir ?? (locale ? directionOf(locale) : envDir === "rtl" ? "rtl" : "ltr"),
  }
}

/** A component's messages: defaults, then the provider's for its scope, then its prop. */
export function useMessages<S extends keyof RindMessageScopes>(
  scope: S,
  defaults: ScopeMessages<S>,
  own?: MessageOverrides<ScopeMessages<S>>,
): ScopeMessages<S> {
  const config = useContext(RindContext)
  // The provider's overrides for this scope were checked against ScopeMessages<S> (props).
  const provided = config?.messages[scope] as MessageOverrides<ScopeMessages<S>> | undefined
  return useMemo(() => resolveMessages(defaults, provided, own), [defaults, provided, own])
}

/** The typeahead timeout: the component's prop, then the provider, then 1000 ms. */
export function useTypeaheadTimeout(own?: number): number {
  const config = useContext(RindContext)
  return own ?? config?.typeaheadTimeout ?? DEFAULT_TYPEAHEAD_TIMEOUT
}

/** The provider's icon component for `name`, if any. */
export function useIcon(name: IconName): ComponentType | undefined {
  return useContext(RindContext)?.icons[name]
}
