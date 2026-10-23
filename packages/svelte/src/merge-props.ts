import { createMergeProps, joinHandlers as join } from "@rind-ui/core/internal"

export type { RindEventExtension } from "@rind-ui/core/internal"

const isHandler = (key: string) => /^on[a-z]/.test(key)

/**
 * Merges a part's props with consumer layers, later layers winning (see the core helper):
 * handlers chain, consumer first, `event.preventRindHandler()` skips the part's; class
 * becomes an array (Svelte joins it), style strings concatenate; attachments (symbol keys)
 * are all kept.
 */
export const mergeProps = createMergeProps({
  isHandler,
  mergeStyle: (a, b) => `${String(a)}; ${String(b)}`,
})

type Props = Readonly<Record<string | symbol, unknown>>

/** A part's own props from several core modules; same-named handlers all run in order. */
export const joinHandlers = (...sources: Props[]) => join(isHandler, ...sources)
