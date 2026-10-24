import {
  computed,
  Directive,
  type EnvironmentProviders,
  InjectionToken,
  inject,
  input,
  makeEnvironmentProviders,
  type Signal,
  type Type,
} from "@angular/core"
import {
  type Announcer,
  type BaseDomEnvironment,
  type Capability,
  type DomEnvironmentOptions,
  type MessageOverrides,
  type Messages,
  type ProvidedBy,
  resolveMessages,
} from "@rind-ui/core"
import {
  type AnyScopedMessages,
  type EnvironmentHolder,
  environmentFor,
  environmentHolder,
  type ProviderConfig,
  type ProviderOptions,
  resolveProvider,
} from "@rind-ui/core/internal"

/** Icon components by name, rendered by indicator parts that got no content. */
export type RindIcons = Readonly<Record<string, Type<unknown>>>

/** Message overrides by component scope: `{ dialog: { close: "Chiudi" } }`. */
export type ScopedMessages = AnyScopedMessages

/** What `provideRind()` and `rindProvider` take. */
export interface RindOptions {
  readonly locale?: string
  /** Default: the locale's direction. */
  readonly dir?: "ltr" | "rtl"
  readonly messages?: ScopedMessages
  readonly announcer?: Announcer | "live-region" | "aria-notify"
  /** Typeahead reset delay for every component below (default 1000 ms). */
  readonly typeaheadTimeout?: number
  /** Further environment overrides (platform, reduced motion, nonce, …). */
  readonly environment?: DomEnvironmentOptions
  readonly icons?: RindIcons
}

type Config = ProviderConfig<RindIcons>
const RIND = new InjectionToken<Signal<Config>>("rind-ui.provider")

const parentConfig = () => inject(RIND, { optional: true, skipSelf: true })

/**
 * Locale, direction, message overrides, announcer, typeahead timeout, environment and icons for
 * the whole application (`bootstrapApplication(App, { providers: [provideRind({ … })] })`) or a
 * route. Nested providers override their parent field by field; a component input overrides
 * the provider.
 */
export function provideRind(options: RindOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: RIND,
      useFactory: () => {
        const parent = parentConfig()
        return computed(() => resolveProvider<RindIcons>(parent?.(), options))
      },
    },
  ])
}

/** `provideRind()` for a subtree of a template: `<div rindProvider locale="it">`. */
@Directive({
  selector: "[rindProvider]",
  providers: [{ provide: RIND, useFactory: () => inject(RindProvider).config }],
})
export class RindProvider {
  readonly locale = input<string>()
  readonly dir = input<"ltr" | "rtl">()
  readonly messages = input<ScopedMessages>()
  readonly announcer = input<RindOptions["announcer"]>()
  readonly typeaheadTimeout = input<number>()
  readonly environment = input<DomEnvironmentOptions>()
  readonly icons = input<RindIcons>()
  private readonly parent = parentConfig()
  /** @internal */
  readonly config = computed(() => {
    const own: ProviderOptions<RindIcons> = {
      locale: this.locale(),
      dir: this.dir(),
      messages: this.messages(),
      announcer: this.announcer(),
      typeaheadTimeout: this.typeaheadTimeout(),
      environment: this.environment(),
      icons: this.icons(),
    }
    return resolveProvider<RindIcons>(this.parent?.(), own)
  })
}

/**
 * The provider's environment (or a default one, with no provider): the base capabilities plus
 * the on-demand ones named, e.g. `injectEnvironment(announcerCapability)`.
 *
 * Read lazily: a part is created before the inputs of a `rindProvider` around it in the same
 * template are set, so each access resolves the provider's current environment (the same object
 * while the provider's inputs do not change).
 */
export function injectEnvironment<const C extends readonly Capability[]>(
  ...capabilities: C
): BaseDomEnvironment & ProvidedBy<C> {
  type Env = BaseDomEnvironment & ProvidedBy<C>
  const config = inject(RIND, { optional: true })
  const fallback = environmentHolder({})
  let holder: EnvironmentHolder | undefined
  let env: Env | undefined
  const current = (): Env => {
    const next = config?.().env ?? fallback
    if (next !== holder || env === undefined) {
      holder = next
      env = environmentFor(next, capabilities)
    }
    return env
  }
  // Every property read goes to the current environment; the proxy itself holds nothing.
  return new Proxy({} as Env, {
    get: (_, key) => Reflect.get(current(), key),
    has: (_, key) => Reflect.has(current(), key),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(current(), key)
      return descriptor && { ...descriptor, configurable: true }
    },
  })
}

/** A component's messages: defaults, then the provider's for its scope, then its input. */
export function injectMessages<M extends Messages>(
  scope: string,
  defaults: M,
  own: () => MessageOverrides<M> | undefined = () => undefined,
): Signal<M> {
  const config = inject(RIND, { optional: true })
  return computed(() => {
    // The provider's overrides for a scope are that component's (checked where they are written).
    const provided = config?.().messages[scope] as MessageOverrides<M> | undefined
    return resolveMessages(defaults, provided, own())
  })
}
