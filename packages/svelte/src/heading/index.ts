import Level from "./heading-level.svelte"
import Root from "./heading-root.svelte"

export { useHeadingContextLevel, useHeadingLevel } from "./context"
export type { HeadingLevelProps, HeadingProps, HeadingState } from "./types"

/** A heading whose level follows the nesting of `Heading.Level` sections (default 2). */
export const Heading = Object.assign(Root, { Level })
