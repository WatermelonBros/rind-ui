import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLFieldsetAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface FieldsetState {
  readonly disabled: boolean
  readonly invalid: boolean
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<FieldsetState>]> | undefined
  readonly children?: Snippet<[FieldsetState]> | undefined
}

export type FieldsetRootProps = Part<HTMLFieldsetAttributes> & {
  /** Disables every control inside, native and rind-ui (portalled parts too). */
  readonly disabled?: boolean | undefined
  /** Shows the ErrorMessage; never passed to the controls inside. */
  readonly invalid?: boolean | undefined
}
export type FieldsetLegendProps = Part<HTMLAttributes<HTMLLegendElement>>
export type FieldsetDescriptionProps = Part<HTMLAttributes<HTMLParagraphElement>>
export type FieldsetErrorMessageProps = Part<HTMLAttributes<HTMLParagraphElement>> & {
  /** Rendered while valid too (it is never a live region). */
  readonly forceMount?: boolean | undefined
}
