// The nearest composite host (a Toolbar or one of its groups): hosted composites (Toggle
// Group, Radio Group) and the toolbar's own controls join its roving focus through it.
import type { CompositeHost } from "@rind-ui/core"
import { type InjectionKey, inject, onBeforeUnmount, onMounted, type Ref, watch } from "vue"

export const CompositeHostKey: InjectionKey<CompositeHost | null> = Symbol("rind-ui.composite-host")

export const useCompositeHost = (): CompositeHost | null => inject(CompositeHostKey, null)

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
  el: Ref<Element | null>,
): void {
  if (!host) return
  let stop: (() => void) | undefined
  onMounted(() =>
    watch(
      () => JSON.stringify(item()),
      () => {
        stop?.()
        stop = undefined
        const element = el.value
        if (!element) return
        const { id, skip, textValue } = item()
        stop = host.register({ key: id, disabled: skip, textValue, element })
      },
      { immediate: true },
    ),
  )
  onBeforeUnmount(() => stop?.())
}
