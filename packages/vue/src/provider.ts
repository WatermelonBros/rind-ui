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
  type Component,
  type ComputedRef,
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onScopeDispose,
  type PropType,
  provide,
  shallowRef,
} from "vue"
import type { IconName, RindIcons } from "./icons"

/**
 * Message types by component scope. Each component declares its own, so provider overrides
 * are checked like the component's `messages` prop:
 *
 * ```ts
 * declare module "@rind-ui/vue" {
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
const RindKey: InjectionKey<ComputedRef<Config>> = Symbol("rind-ui.provider")

/**
 * Locale, direction, message overrides, announcer, typeahead timeout, environment and icons
 * for every component below. Nested providers override their parent field by field; a
 * component prop overrides the provider.
 */
export const RindProvider = defineComponent({
  name: "RindProvider",
  props: {
    locale: String,
    /** Default: the locale's direction. */
    dir: String as PropType<"ltr" | "rtl">,
    messages: Object as PropType<ScopedMessages>,
    announcer: [Object, String] as PropType<Announcer | "live-region" | "aria-notify">,
    /** Typeahead reset delay for every component below (default 1000 ms). */
    typeaheadTimeout: Number,
    /** Further environment overrides (platform, reduced motion, nonce, …). */
    environment: Object as PropType<DomEnvironmentOptions>,
    /** Icon components by name, rendered by indicator parts that got no children. */
    icons: Object as PropType<RindIcons>,
  },
  setup(props, { slots }) {
    const parent = inject(RindKey, null)
    const config = computed(() =>
      resolveProvider<RindIcons>(parent?.value, {
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
    provide(RindKey, config)
    return () => slots["default"]?.()
  },
})

/**
 * The provider's environment (or a default one, with no provider): the base capabilities plus
 * the on-demand ones named, e.g. `useEnvironment(announcerCapability)`. Read once, at setup.
 */
export function useEnvironment<const C extends readonly Capability[]>(
  ...capabilities: C
): BaseDomEnvironment & ProvidedBy<C> {
  const config = inject(RindKey, null)
  return environmentFor(config?.value.env ?? environmentHolder({}), capabilities)
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
  const current = shallowRef(read())
  if (typeof document !== "undefined" && source.subscribe) {
    onScopeDispose(source.subscribe(() => (current.value = read())))
  }
  return computed(() => {
    const own = locale()
    return {
      locale: own ?? current.value.locale ?? "en",
      dir:
        dir() ?? (own ? directionOf(own) : current.value.dir === "rtl" ? "rtl" : ("ltr" as const)),
    }
  })
}

/** A component's messages: defaults, then the provider's for its scope, then its prop. */
export function useMessages<S extends keyof RindMessageScopes>(
  scope: S,
  defaults: ScopeMessages<S>,
  own: () => MessageOverrides<ScopeMessages<S>> | undefined = () => undefined,
): ComputedRef<ScopeMessages<S>> {
  const config = inject(RindKey, null)
  return computed(() => {
    // The provider's overrides for this scope were checked against ScopeMessages<S> (props).
    const provided = config?.value.messages[scope] as MessageOverrides<ScopeMessages<S>> | undefined
    return resolveMessages(defaults, provided, own())
  })
}

/** The typeahead timeout: the component's prop, then the provider, then 1000 ms. */
export function useTypeaheadTimeout(own: () => number | undefined): ComputedRef<number> {
  const config = inject(RindKey, null)
  return computed(() => own() ?? config?.value.typeaheadTimeout ?? DEFAULT_TYPEAHEAD_TIMEOUT)
}

/** The provider's icon component for `name`, if any. */
export function useIcon(name: IconName): ComputedRef<Component | undefined> {
  const config = inject(RindKey, null)
  return computed(() => config?.value.icons[name])
}
