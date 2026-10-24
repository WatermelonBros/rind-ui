// The selection indicator's effect (Tabs, Segmented Control): measures the selected item
// relative to the indicator's parent and sends the box to the machine (state, never an
// imperative style). The first measurement and layout changes never animate; a selection
// change does.
import { type IndicatorBox, type IndicatorCause, selectionIndicator } from "@rind-ui/core"
import { onBeforeUnmount, onMounted, type Ref, watch } from "vue"

export function useSelectionIndicator(options: {
  readonly el: Ref<Element | null>
  /** The selected item's element id (null when nothing is selected). */
  readonly selectedId: () => string | null
  /** The item part's selector inside the indicator's parent (observed for resizes). */
  readonly itemSelector: string
  /** Changes when items register or unregister. */
  readonly collection: () => unknown
  readonly onMeasure: (box: IndicatorBox | null, cause: IndicatorCause) => void
}): void {
  const { el, selectedId, itemSelector, collection, onMeasure } = options
  onMounted(() => {
    const node = el.value
    if (!node) return
    const h = selectionIndicator({
      container: () => node.parentElement,
      item: () => {
        const id = selectedId()
        return id === null ? null : node.ownerDocument.getElementById(id)
      },
      items: () => [...(node.parentElement?.querySelectorAll<HTMLElement>(itemSelector) ?? [])],
      onMeasure,
    })
    h.measure("layout")
    watch(selectedId, () => h.measure("selection"), { flush: "post" })
    watch(collection, () => h.refresh(), { flush: "post" })
    onBeforeUnmount(() => h.dispose())
  })
}
