import { getContext, hasContext, setContext } from "svelte"

/** A typed context: `set` in a parent component, `get` (or `maybe`) below it. */
export function createContext<T>(name: string) {
  const key = Symbol(`rind-ui.${name}`)
  return {
    set: (value: T) => setContext(key, value),
    get: (): T => {
      if (!hasContext(key)) throw new Error(`[rind-ui] ${name}: used outside its root part`)
      return getContext<T>(key)
    },
    maybe: (): T | undefined => (hasContext(key) ? getContext<T>(key) : undefined),
  }
}
