import { type Accessor, createSignal } from "solid-js"
import { afterMount } from "./lifecycle"

/**
 * The tag a part renders: `fallback`, or the element's own once mounted when `render`
 * substitutes it (the server and the first client render use the fallback).
 */
export function useRenderedTag(
  fallback: () => string,
  render: () => unknown,
  el: Accessor<Element | null>,
): Accessor<string> {
  const [measured, setMeasured] = createSignal<string | undefined>()
  afterMount(() => {
    const node = el()
    if (render() && node) setMeasured(node.tagName.toLowerCase())
  })
  return () => (render() ? (measured() ?? fallback()) : fallback())
}
