// What a RindProvider resolves, independent of the framework: nested providers override their
// parent field by field, a new locale brings its own direction, and each on-demand capability
// is built once per provider (one announcer, one set of live regions).
import { DEFAULT_TYPEAHEAD_TIMEOUT } from "../dom/keyboard"
import {
  type BaseDomEnvironment,
  baseDomEnvironment,
  type DomEnvironmentOptions,
} from "../env/base-environment"
import type { Announcer } from "../env/capabilities"
import { type Capability, extendEnvironment, type ProvidedBy } from "../env/dom-capabilities"

/** Message overrides by component scope, untyped (adapters type them at their props). */
export type AnyScopedMessages = Readonly<Record<string, Readonly<Record<string, unknown>>>>

export interface ProviderOptions<Icons> {
  readonly locale?: string | undefined
  readonly dir?: "ltr" | "rtl" | undefined
  readonly messages?: AnyScopedMessages | undefined
  readonly announcer?: Announcer | "live-region" | "aria-notify" | undefined
  readonly typeaheadTimeout?: number | undefined
  readonly environment?: DomEnvironmentOptions | undefined
  readonly icons?: Icons | undefined
}

export interface ProviderConfig<Icons> {
  readonly locale: string | undefined
  readonly dir: "ltr" | "rtl" | undefined
  readonly messages: AnyScopedMessages
  readonly announcer: ProviderOptions<Icons>["announcer"]
  readonly typeaheadTimeout: number
  readonly environment: DomEnvironmentOptions
  readonly icons: Partial<Icons>
  readonly env: EnvironmentHolder
}

/** One provider's environment: the base, and each capability built on first request. */
export interface EnvironmentHolder {
  readonly base: BaseDomEnvironment
  get(capability: Capability): unknown
}

export function environmentHolder(options: DomEnvironmentOptions): EnvironmentHolder {
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

/** The config a provider gives its subtree, from its own options and its parent's config. */
export function resolveProvider<Icons extends object>(
  parent: ProviderConfig<Icons> | null | undefined,
  own: ProviderOptions<Icons>,
): ProviderConfig<Icons> {
  const { locale, dir, messages, announcer, typeaheadTimeout, environment, icons } = own
  const merged = {
    locale: locale ?? parent?.locale,
    // A new locale without a direction takes the locale's direction, not the parent's.
    dir: dir ?? (locale === undefined ? parent?.dir : undefined),
    messages: mergeMessages(parent?.messages, messages),
    announcer: announcer ?? parent?.announcer,
    typeaheadTimeout: typeaheadTimeout ?? parent?.typeaheadTimeout ?? DEFAULT_TYPEAHEAD_TIMEOUT,
    environment: { ...parent?.environment, ...environment },
    icons: { ...parent?.icons, ...icons } as Partial<Icons>,
  }
  const options: DomEnvironmentOptions = {
    ...merged.environment,
    ...(merged.locale === undefined ? {} : { locale: merged.locale }),
    ...(merged.dir === undefined ? {} : { dir: merged.dir }),
    ...(merged.announcer === undefined ? {} : { announcer: merged.announcer }),
  }
  return { ...merged, env: environmentHolder(options) }
}

/** The environment with the base capabilities plus exactly the requested ones. */
export function environmentFor<const C extends readonly Capability[]>(
  holder: EnvironmentHolder,
  capabilities: C,
): BaseDomEnvironment & ProvidedBy<C> {
  if (capabilities.length === 0) return holder.base as BaseDomEnvironment & ProvidedBy<C>
  const additions = Object.fromEntries(capabilities.map((c) => [c.key, holder.get(c)]))
  // Each `c.key` maps to `c.create`'s result: the shape `ProvidedBy<C>` describes.
  return extendEnvironment(holder.base, additions as ProvidedBy<C>)
}
