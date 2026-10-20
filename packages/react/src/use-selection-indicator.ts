"use client"

// The selection indicator's effect (Tabs, Segmented Control): measures the selected item
// relative to the indicator's parent and sends the box to the machine (state, never an
// imperative style). The first measurement and layout changes never animate; a selection
// change does.

import { type IndicatorBox, type IndicatorCause, selectionIndicator } from "@rind-ui/core"
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export function useSelectionIndicator(options: {
  readonly el: RefObject<HTMLElement | null>
  /** The selected item's element id (null when nothing is selected). */
  readonly selectedId: string | null
  /** The item part's selector inside the indicator's parent (observed for resizes). */
  readonly itemSelector: string
  /** Changes when items register or unregister. */
  readonly collection: unknown
  readonly onMeasure: (box: IndicatorBox | null, cause: IndicatorCause) => void
}): void {
  const { el, selectedId, itemSelector, collection, onMeasure } = options
  const latest = useRef({ selectedId, onMeasure })
  latest.current = { selectedId, onMeasure }
  const handle = useRef<ReturnType<typeof selectionIndicator> | null>(null)
  useIsoLayoutEffect(() => {
    const node = el.current
    if (!node) return
    const h = selectionIndicator({
      container: () => node.parentElement,
      item: () => {
        const id = latest.current.selectedId
        return id === null ? null : node.ownerDocument.getElementById(id)
      },
      items: () => [...(node.parentElement?.querySelectorAll<HTMLElement>(itemSelector) ?? [])],
      onMeasure: (box, cause) => latest.current.onMeasure(box, cause),
    })
    handle.current = h
    h.measure("layout")
    return () => {
      h.dispose()
      handle.current = null
    }
  }, [el, itemSelector])
  const lastSelected = useRef(selectedId)
  useIsoLayoutEffect(() => {
    if (lastSelected.current === selectedId) return
    lastSelected.current = selectedId
    handle.current?.measure("selection")
  }, [selectedId])
  const lastCollection = useRef(collection)
  useIsoLayoutEffect(() => {
    if (lastCollection.current === collection) return
    lastCollection.current = collection
    handle.current?.refresh()
  }, [collection])
}
