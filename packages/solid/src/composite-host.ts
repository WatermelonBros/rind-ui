// The nearest composite host (a Toolbar or one of its groups): hosted composites (Toggle
// Group, Radio Group) and the toolbar's own controls join its roving focus through it.
import type { CompositeHost } from "@rind-ui/core"
import { createContext, createEffect, onCleanup, useContext } from "solid-js"
import { afterMount } from "./lifecycle"

export const CompositeHostContext = createContext<CompositeHost | null>(null)

export const useCompositeHost = (): CompositeHost | null => useContext(CompositeHostContext)

/**
 * Registers an element with the host while mounted (key: its id). `skip`: not navigable
 * (disabled and not focusable when disabled).
 */
export function useHostItem(
  host: CompositeHost | null,
  item: () => {
    readonly id: string
    readonly skip: boolean
    readonly textValue?: string | undefined
  },
  el: () => Element | null,
): void {
  if (!host) return
  afterMount(() =>
    createEffect(() => {
      const element = el()
      const { id, skip, textValue } = item()
      if (!element) return
      onCleanup(host.register({ key: id, disabled: skip, textValue, element }))
    }),
  )
}
