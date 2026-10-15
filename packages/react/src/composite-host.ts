// The nearest composite host (a Toolbar or one of its groups): hosted composites (Toggle
// Group, Radio Group) and the toolbar's own controls join its roving focus through it.
// Portals reset it: a component in a popup opened from a host control is standalone.

import type { CompositeHost } from "@rind-ui/core"
import { createContext, type RefObject, useContext, useEffect, useLayoutEffect } from "react"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export const CompositeHostContext = createContext<CompositeHost | null>(null)

export const useCompositeHost = (): CompositeHost | null => useContext(CompositeHostContext)

/**
 * Registers an element with the host at commit time (key: its id). `skip`: not navigable
 * (disabled and not focusable when disabled).
 */
export function useHostItem(
  host: CompositeHost | null,
  item: { readonly id: string; readonly skip: boolean; readonly textValue?: string | undefined },
  ref: RefObject<Element | null>,
): void {
  const { id, skip, textValue } = item
  const register = host?.register
  useIsoLayoutEffect(() => {
    const element = ref.current
    if (!element || !register) return
    return register({ key: id, disabled: skip, textValue, element })
  }, [register, ref, id, skip, textValue])
}
