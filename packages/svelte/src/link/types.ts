import type { Href, LinkCurrent, LinkInput, RouterOptions } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAnchorAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface LinkState {
  readonly disabled: boolean
  readonly current: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

export type LinkProps = Omit<HTMLAnchorAttributes, "href" | "download" | "children"> & {
  /** Typed by `RouterConfig` (augmentable). */
  readonly href?: Href | undefined
  /** Download instead of navigating (the browser handles it); a string names the file. */
  readonly download?: boolean | string | undefined
  /** Passed unchanged to the router's `navigate`. */
  readonly routerOptions?: RouterOptions | undefined
  /** No `href`, `aria-disabled`, out of the Tab order (unless `focusableWhenDisabled`). */
  readonly disabled?: boolean | undefined
  /** Keeps a disabled link in the Tab order (it stays `aria-disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Sets `aria-current` and `data-current`; the link still navigates. */
  readonly current?: LinkCurrent | undefined
  /** Once per activation that is not disabled or prevented, with where it opened. */
  readonly onActivate?: LinkInput["onActivate"]
  /** Another element: spread `props` on it (a non-anchor gets the `role="link"` fallback). */
  readonly child?: Snippet<[ChildArgs<LinkState>]> | undefined
  readonly children?: Snippet<[LinkState]> | undefined
}

export interface RouterProviderProps {
  /** Client navigation, e.g. SvelteKit's `goto`. */
  readonly navigate: (href: Href, options?: RouterOptions) => void
  /** The rendered href (basename): a plain function. */
  readonly href?: ((href: Href) => string) | undefined
  readonly children?: Snippet | undefined
}
