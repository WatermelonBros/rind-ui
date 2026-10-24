// The selection indicator's effect (Tabs, Segmented Control): measures the selected item relative
// to the indicator's parent and sends the box to the machine (state, never an imperative style).
// The first measurement and layout changes never animate; a selection change does.

import {
  afterNextRender,
  afterRenderEffect,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
} from "@angular/core"
import { type IndicatorBox, type IndicatorCause, selectionIndicator } from "@rind-ui/core"

export function injectSelectionIndicator(options: {
  /** The selected item's element id (null when nothing is selected). */
  readonly selectedId: () => string | null
  /** The item part's selector inside the indicator's parent (observed for resizes). */
  readonly itemSelector: () => string
  /** Changes when items register or unregister. */
  readonly collection: () => unknown
  readonly onMeasure: (box: IndicatorBox | null, cause: IndicatorCause) => void
}): void {
  if (inject(PLATFORM_ID) !== "browser") return
  const { selectedId, itemSelector, collection, onMeasure } = options
  const node: Element = inject(ElementRef).nativeElement
  const destroy = inject(DestroyRef)
  let h: ReturnType<typeof selectionIndicator> | undefined
  afterNextRender(() => {
    h = selectionIndicator({
      container: () => node.parentElement,
      item: () => {
        const id = selectedId()
        return id === null ? null : node.ownerDocument.getElementById(id)
      },
      items: () => [...(node.parentElement?.querySelectorAll<HTMLElement>(itemSelector()) ?? [])],
      onMeasure,
    })
    h.measure("layout")
    destroy.onDestroy(() => h?.dispose())
  })
  // After the DOM has the change: a new selection animates, a new set of items re-measures.
  let lastId: string | null | undefined
  let lastCollection: unknown
  afterRenderEffect(() => {
    const id = selectedId()
    const items = collection()
    if (!h) {
      lastId = id
      lastCollection = items
      return
    }
    if (id !== lastId) {
      lastId = id
      h.measure("selection")
    }
    if (items !== lastCollection) {
      lastCollection = items
      h.refresh()
    }
  })
}
