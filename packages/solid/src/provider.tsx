/** @jsxImportSource solid-js */
import {
  type Announcer,
  type BaseDomEnvironment,
  type Capability,
  DEFAULT_TYPEAHEAD_TIMEOUT,
  type DomEnvironmentOptions,
  directionOf,
  type MessageOverrides,
  type Messages,
  type ProvidedBy,
  resolveMessages,
} from "@rind-ui/core"
import {
  type AnyScopedMessages,
  environmentFor,
  environmentHolder,
  type ProviderConfig,
  resolveProvider,
} from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"
import type { IconName, RindIcons } from "./icons"

/**
 * Message types by component scope. Each component declares its own, so provider overrides
 * are checked like the component's `messages` prop:
 *
 * ```ts
 * declare module "@rind-ui/solid" {
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

type Config = ProviderConfig<RindIcons>
const RindContext = createContext<Accessor<Config>>()

export interface RindProviderProps {
  readonly locale?: string | undefined
  /** Default: the locale's direction. */
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: ScopedMessages | undefined
  readonly announcer?: Announcer | "live-region" | "aria-notify" | undefined
  /** Typeahead reset delay for every component below (default 1000 ms). */
  readonly typeaheadTimeout?: number | undefined
  /** Further environment overrides (platform, reduced motion, nonce, …). */
  readonly environment?: DomEnvironmentOptions | undefined
  /** Icon components by name, rendered by indicator parts that got no children. */
  readonly icons?: RindIcons | undefined
  readonly children?: JSX.Element
}

/**
 * Locale, direction, message overrides, announcer, typeahead timeout, environment and icons
 * for every component below. Nested providers override their parent field by field; a
 * component prop overrides the provider.
 */
export function RindProvider(props: RindProviderProps) {
  const parent = useContext(RindContext)
  const config = createMemo(() =>
    resolveProvider<RindIcons>(parent?.(), {
      locale: props.locale,
      dir: props.dir,
      // ScopedMessages is a typed view of the same record shape.
      messages: props.messages as AnyScopedMessages | undefined,
      announcer: props.announcer,
      typeaheadTimeout: props.typeaheadTimeout,
      environment: props.environment,
      icons: props.icons,
    }),
  )
  return <RindContext.Provider value={config}>{props.children}</RindContext.Provider>
}

/**
 * The provider's environment (or a default one, with no provider): the base capabilities plus
 * the on-demand ones named, e.g. `useEnvironment(announcerCapability)`. Read once, when the
 * component runs.
 */
export function useEnvironment<const C extends readonly Capability[]>(
  ...capabilities: C
): BaseDomEnvironment & ProvidedBy<C> {
  const config = useContext(RindContext)
  return environmentFor(config?.().env ?? environmentHolder({}), capabilities)
}

/**
 * Locale and direction for a component: its props, then the provider, then the document
 * (updating when `<html lang>` or the browser language changes).
 */
export function useLocale(
  locale: () => string | undefined,
  dir: () => "ltr" | "rtl" | undefined = () => undefined,
) {
  const source = useEnvironment().locale
  const read = () => ({ locale: source.locale(), dir: source.dir() })
  const [current, setCurrent] = createSignal(read())
  if (typeof document !== "undefined" && source.subscribe) {
    onCleanup(source.subscribe(() => setCurrent(read())))
  }
  return createMemo(() => {
    const own = locale()
    return {
      locale: own ?? current().locale ?? "en",
      dir: dir() ?? (own ? directionOf(own) : current().dir === "rtl" ? "rtl" : ("ltr" as const)),
    }
  })
}

/** A component's messages: defaults, then the provider's for its scope, then its prop. */
export function useMessages<S extends keyof RindMessageScopes>(
  scope: S,
  defaults: ScopeMessages<S>,
  own: () => MessageOverrides<ScopeMessages<S>> | undefined = () => undefined,
): Accessor<ScopeMessages<S>> {
  const config = useContext(RindContext)
  return createMemo(() => {
    // The provider's overrides for this scope were checked against ScopeMessages<S> (props).
    const provided = config?.().messages[scope] as MessageOverrides<ScopeMessages<S>> | undefined
    return resolveMessages(defaults, provided, own())
  })
}

/** The typeahead timeout: the component's prop, then the provider, then 1000 ms. */
export function useTypeaheadTimeout(own: () => number | undefined): Accessor<number> {
  const config = useContext(RindContext)
  return () => own() ?? config?.().typeaheadTimeout ?? DEFAULT_TYPEAHEAD_TIMEOUT
}

/** The provider's icon component for `name`, if any. */
export function useIcon(name: IconName) {
  const config = useContext(RindContext)
  return () => config?.().icons[name]
}
