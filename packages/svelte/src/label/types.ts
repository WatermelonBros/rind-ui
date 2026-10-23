import type { Snippet } from "svelte"
import type { HTMLLabelAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export type LabelProps = Omit<HTMLLabelAttributes, "children"> & {
  /** Another element; a non-`<label>` forwards focus to `for`'s element itself. */
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
