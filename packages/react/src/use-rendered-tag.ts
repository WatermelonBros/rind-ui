import { isValidElement, type RefObject, useEffect, useLayoutEffect, useState } from "react"
import type { RenderProp } from "./render"

// useLayoutEffect warns on the server; it never runs there anyway.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/**
 * The tag a part renders, lowercase: known statically from the default element or a host
 * `render` element (so the server and the hydrating render agree), corrected from the ref
 * after mount when `render` is a component or a function.
 */
export function useRenderedTag<S>(
  fallback: string,
  render: RenderProp<S> | undefined,
  ref: RefObject<Element | null>,
): string {
  const known =
    render === undefined
      ? fallback
      : isValidElement(render) && typeof render.type === "string"
        ? render.type
        : null
  const [measured, setMeasured] = useState<string | null>(null)
  useIsoLayoutEffect(() => {
    // Known statically: no measuring, so no extra render.
    if (known !== null) return
    const actual = ref.current?.tagName.toLowerCase() ?? null
    if (actual !== measured) setMeasured(actual)
  })
  return known ?? measured ?? fallback
}
