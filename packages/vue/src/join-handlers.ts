import { joinHandlers as join } from "@rind-ui/core/internal"

type Props = Readonly<Record<string | symbol, unknown>>

/** A part's own props from several core modules; same-named handlers all run in order. */
export const joinHandlers = (...sources: Props[]) => join((key) => /^on[A-Z]/.test(key), ...sources)
