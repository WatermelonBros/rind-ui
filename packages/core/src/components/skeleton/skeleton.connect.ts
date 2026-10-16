// Skeleton's parts (design §3): the busy flag on Content only, silent and inert Items, a
// visually hidden loading text in Status. No role, no live region, no inline style except
// the visually hidden one.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"

declare const process: { env: { NODE_ENV?: string } }

export interface SkeletonConnectState {
  readonly instance: string
  readonly loading: boolean
  /** Root's `animate` (default true). */
  readonly animate: boolean
}

export interface SkeletonItemInput {
  /** The Item's own override of the Root's state. */
  readonly loading?: boolean | undefined
  /** The Item's own override of the Root's `animate`. */
  readonly animate?: boolean | undefined
  /** Wraps content (stale text, a control): made `inert` too while loading. */
  readonly hasChildren: boolean
}

const stateOf = (loading: boolean) => (loading ? "loading" : "loaded")

export function skeletonConnect(state: SkeletonConnectState) {
  const base = (part: string, loading = state.loading): PartProps => ({
    ...scopeAttrs("skeleton", part, state.instance),
    "data-state": stateOf(loading),
  })
  return {
    root: (): PartProps => base("root"),
    /** `null` when loaded: Status renders nothing. */
    status: (): PartProps | null =>
      state.loading ? { ...base("status"), style: visuallyHiddenStyle } : null,
    content: (): PartProps => ({
      ...base("content"),
      "aria-busy": state.loading ? "true" : undefined,
    }),
    item: (input: SkeletonItemInput): PartProps => {
      const loading = input.loading ?? state.loading
      return {
        ...base("item", loading),
        "aria-hidden": loading ? "true" : undefined,
        inert: loading && input.hasChildren ? true : undefined,
        "data-animate": dataFlag(loading && (input.animate ?? state.animate)),
      }
    },
  }
}

/** Development check after mount: Status inside the busy region may be suppressed there. */
export function warnStatusPlacement(status: { closest(selector: string): unknown }): void {
  if (process.env.NODE_ENV === "production") return
  if (status.closest('[data-scope="skeleton"][data-part="content"]')) {
    console.warn(
      "[rind-ui] skeleton: Skeleton.Status is inside Skeleton.Content; move it outside Content, where assistive technology that honours aria-busy still reads it",
    )
  }
}
