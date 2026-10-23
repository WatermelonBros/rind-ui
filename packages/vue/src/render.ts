import { stripMarker } from "@rind-ui/core/internal"
import {
  Comment,
  cloneVNode,
  createTextVNode,
  Fragment,
  h,
  isVNode,
  type VNode,
  type VNodeChild,
} from "vue"
import { mergeProps } from "./merge-props"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

type Props = Record<string | symbol, unknown>

/** Every part accepts `asChild`: its single child element receives the part's props. */
export const asChildProp = {
  /** Render the slot's single element instead of the default one, with the part's props. */
  asChild: Boolean,
} as const

/** The element vnodes of a slot's output, fragments flattened, comments dropped. */
export function elements(children: VNodeChild): VNode[] {
  const list = Array.isArray(children) ? children : [children]
  return list.flatMap((child): VNode[] => {
    // Text is not an element: kept (as a text vnode) so the check below rejects it.
    if (!isVNode(child)) {
      const text = typeof child === "string" || typeof child === "number" ? String(child) : ""
      return text.trim() === "" ? [] : [createTextVNode(text)]
    }
    if (child.type === Comment) return []
    if (child.type === Fragment) return elements(child.children as VNodeChild)
    return [child]
  })
}

/**
 * The tag a part renders, lowercase: the default, or with `asChild` the child element's tag
 * when it is a host element (a component child is measured from the element after mount).
 */
export function renderedTag(
  fallback: string,
  children: VNodeChild | undefined,
  asChild: boolean,
  measured?: string | null,
): string {
  if (!asChild) return fallback
  const child = elements(children ?? null)[0]
  return typeof child?.type === "string" ? child.type : (measured ?? fallback)
}

/**
 * Renders a part as its default tag with the slot's content, or — with `asChild` — as the
 * slot's single element, its own props the consumer layer of the merge (child props win,
 * handlers chain, refs compose).
 */
export function renderPart(
  tag: string,
  props: Props,
  children: VNodeChild | undefined,
  asChild = false,
): VNode {
  // Connect gives some parts their content as `children` (a calendar heading, a pin cell):
  // the slot's content wins, else it renders.
  if ("children" in props) {
    const { children: own, ...rest } = props
    return renderPart(tag, rest, children ?? (own as VNodeChild), asChild)
  }
  if (!asChild) return h(tag, stripMarker(props), children as never)
  const found = elements(children ?? null)
  const child = found[0]
  if (found.length !== 1 || !child || typeof child.type === "symbol") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[rind-ui] ${String(props["data-scope"])}.${String(props["data-part"])}: asChild needs exactly one element child; rendering the default <${tag}>.`,
      )
    }
    return h(tag, stripMarker(props), children as never)
  }
  const merged = stripMarker(mergeProps(props, (child.props ?? {}) as Props))
  // An empty props base: cloneVNode would otherwise merge the child's props a second time.
  // Passing extra props marks the clone FULL_PROPS, so later patches see every merged prop.
  return cloneVNode({ ...child, props: null }, merged as never, true)
}
