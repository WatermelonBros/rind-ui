/** Skeleton's messages (English defaults), overridable per instance and through the provider. */
export const skeletonMessages = {
  /** The Status text while loading. */
  loading: "Loading",
  /** Announced on `loading → loaded` with `announceOnLoad={true}`. */
  loaded: "Loaded",
} as const satisfies Record<string, string>

export type SkeletonMessages = { readonly loading: string; readonly loaded: string }
