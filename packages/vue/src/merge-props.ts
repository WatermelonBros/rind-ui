import { createMergeProps } from "@rind-ui/core/internal"

export type { RindEventExtension } from "@rind-ui/core/internal"

type RefFn = (el: unknown) => void

/** A component instance's element (a ref on a component receives the instance). */
export const elementOf = (value: unknown): Element | null =>
  value instanceof Element
    ? value
    : value && typeof value === "object" && "$el" in value && value.$el instanceof Element
      ? value.$el
      : null

/** Composes function refs (the only refs a part puts in its props). */
export function composeRefs(a: unknown, b: unknown): RefFn {
  return (el) => {
    for (const ref of [a, b]) if (typeof ref === "function") (ref as RefFn)(el)
  }
}

/**
 * Merges a part's props with consumer layers, later layers winning (see the core helper):
 * handlers chain, consumer first, `event.preventRindHandler()` skips the part's; class and
 * style become arrays Vue normalises; refs compose.
 */
export const mergeProps = createMergeProps({
  isHandler: (key) => /^on[A-Z]/.test(key),
  mergeStyle: (a, b) => [a, b],
  refKey: "ref",
  composeRefs,
})

const setters = new WeakMap<object, (node: unknown) => void>()

/**
 * A stable ref callback writing the element into `target`. A function created in the render
 * would be a new ref on every patch: Vue calls the old one with null and the new one with the
 * element, so anything watching `target` would see it leave and come back each time.
 */
export function refTo(target: { value: Element | null }): (node: unknown) => void {
  let set = setters.get(target)
  if (!set) {
    set = (node) => {
      target.value = elementOf(node)
    }
    setters.set(target, set)
  }
  return set
}
