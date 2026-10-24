import type { Toaster, ToastMessages, ToastSnapshot } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes, HTMLLiAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface ToasterProps {
  readonly toaster: Toaster
  /** Base of the region's generated ids (default: generated). */
  readonly id?: string | undefined
  /** One toast's markup (newest first). */
  readonly children: Snippet<[ToastSnapshot]>
  readonly messages?: Partial<ToastMessages> | undefined
  /** Default true: rendered in the shared portal. */
  readonly portal?: boolean | undefined
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<ToastSnapshot>]> | undefined
  readonly children?: Snippet<[ToastSnapshot]> | undefined
}
export type ToastRootProps = Part<HTMLLiAttributes>
export type ToastTextProps = Part<HTMLAttributes<HTMLDivElement>>
export type ToastButtonProps = Part<HTMLButtonAttributes>
