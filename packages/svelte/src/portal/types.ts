import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export type PortalProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Where to render (default: resolved from the logical parent, then `body`). */
  readonly container?: Element | ShadowRoot | null | undefined
  /** The element the content belongs to (its trigger): target resolution and dir/lang/theme. */
  readonly logicalParent?: (() => Element | null) | undefined
  /**
   * Keeps the host's `dir`, `lang` and theme in step with the logical parent as they change;
   * `false` copies them once. Default: true.
   */
  readonly observe?: boolean | undefined
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  /** The content rendered into the portal host. */
  readonly children?: Snippet | undefined
}
