import { $PROXY, type Accessor, type JSX, children as resolveOnce, untrack } from "solid-js"

type Props = Record<string | symbol, unknown>

/**
 * Element substitution: the part's props (spread them on the element you render) and its
 * state. Called once; both arguments are reactive views, so spreading `props` and reading
 * `state` in JSX track the part.
 */
export type RenderProp<S> = (props: Props, state: S) => JSX.Element

/**
 * A reactive view of an accessor's object: reading a key, enumerating the keys or spreading it
 * tracks the accessor. Marked as a Solid proxy, so Solid's spread and `mergeProps` keep
 * following keys that appear or disappear later (an attribute added on a state change).
 */
export function reactive<T extends object>(source: Accessor<T>): T {
  // The proxy forwards every read to the accessor's current object: it has T's shape.
  return new Proxy({} as T, {
    get: (_, key) => (key === $PROXY ? true : (source() as Props)[key]),
    has: (_, key) => key === $PROXY || key in source(),
    ownKeys: () => Reflect.ownKeys(source()),
    getOwnPropertyDescriptor: (_, key) =>
      key in source()
        ? { enumerable: true, configurable: true, get: () => (source() as Props)[key] }
        : undefined,
  })
}

/**
 * A part's element: `render(props, state)` when the consumer substitutes it (props include the
 * children, which Solid's spread inserts), else the part's own element.
 */
export function renderPart<S>(
  render: RenderProp<S> | undefined,
  props: Accessor<Props>,
  state: S,
  children: () => JSX.Element,
  element: (props: Props) => JSX.Element,
): JSX.Element {
  const view = reactive(props)
  if (!render) return element(view)
  // Solid's JSX getter creates the children on every read, and the proxy reads them on every
  // lookup: resolve them once, so a state change does not remount them.
  const resolved = resolveOnce(children)
  const withChildren = reactive(() => ({ ...props(), children: resolved() }))
  return untrack(() => render(withChildren, state))
}

/** Children may be a function of the part's state. */
export function resolveChildren<S>(
  children: JSX.Element | ((state: S) => JSX.Element) | undefined,
  state: S,
): JSX.Element {
  return typeof children === "function" && children.length > 0
    ? (children as (state: S) => JSX.Element)(state)
    : (children as JSX.Element)
}
