// The nearest composite host (a Toolbar or one of its groups): hosted composites (Toggle
// Group, Radio Group) and the toolbar's own controls join its roving focus through it.

import {
  afterNextRender,
  DestroyRef,
  effect,
  InjectionToken,
  inject,
  PLATFORM_ID,
  untracked,
} from "@angular/core"
import type { CompositeHost } from "@rind-ui/core"

export const COMPOSITE_HOST = new InjectionToken<CompositeHost>("rind-ui.composite-host")

export const injectCompositeHost = (): CompositeHost | null =>
  inject(COMPOSITE_HOST, { optional: true })

/**
 * Registers an element with the host while rendered (key: its id). `skip`: not navigable
 * (disabled and not focusable when disabled).
 */
export function injectHostItem(
  host: CompositeHost | null,
  item: () => {
    readonly id: string
    readonly skip: boolean
    readonly textValue?: string | undefined
  },
  element: Element,
): void {
  if (!host || inject(PLATFORM_ID) !== "browser") return
  let stop: (() => void) | undefined
  let ready = false
  let last: string | undefined
  const register = () => {
    const { id, skip, textValue } = untracked(item)
    const key = JSON.stringify([id, skip, textValue])
    if (key === last) return
    last = key
    stop?.()
    stop = host.register({ key: id, disabled: skip, textValue, element })
  }
  afterNextRender(() => {
    ready = true
    register()
  })
  effect(() => {
    item()
    if (ready) register()
  })
  inject(DestroyRef).onDestroy(() => stop?.())
}
