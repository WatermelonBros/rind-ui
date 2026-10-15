// Client routing as an environment capability: links call `router.navigate` instead of
// letting the browser load the page. Hooks-free on purpose: `href` is a plain function, so
// it can run during the server render and is never called conditionally (RA#7028, #9490).

/**
 * Augment to type `href` and `routerOptions` for your router:
 * `declare module "@rind-ui/core" { interface RouterConfig { routerOptions: { replace?: boolean } } }`
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by consumers (declaration merging)
export interface RouterConfig {}

export type Href = RouterConfig extends { href: infer H } ? H : string
export type RouterOptions = RouterConfig extends { routerOptions: infer O } ? O : never

export interface Router {
  /** Client navigation; `href` is the value given to the link, never the resolved one. */
  navigate(href: Href, routerOptions: RouterOptions | undefined): void
  /** The rendered href (basename, locale prefix). Pure, synchronous, deterministic. */
  href?(href: Href): string
}

export interface RouterCapability {
  readonly router?: Router | undefined
}
