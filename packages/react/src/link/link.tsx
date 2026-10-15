import {
  activateLink,
  focusAttrs,
  type Href,
  type LinkCurrent,
  type LinkEnv,
  type LinkInput,
  linkConnect,
  type RouterOptions,
  warnInteractiveContent,
  warnLinkFallback,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface LinkState {
  readonly disabled: boolean
  readonly current: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

export type LinkProps = Omit<ComponentPropsWithRef<"a">, "href" | "download" | "referrerPolicy"> & {
  /** Typed by `RouterConfig` (augmentable). */
  readonly href?: Href
  readonly download?: boolean | string
  readonly referrerPolicy?: ComponentPropsWithRef<"a">["referrerPolicy"]
  /** Passed unchanged to the router's `navigate`. */
  readonly routerOptions?: RouterOptions
  readonly disabled?: boolean
  /** Keeps a disabled link in the Tab order (it stays `aria-disabled`). */
  readonly focusableWhenDisabled?: boolean
  readonly current?: LinkCurrent
  /** Once per activation that is not disabled or prevented, with where it opened. */
  readonly onActivate?: LinkInput["onActivate"]
  /**
   * Another element or component. A host element (`<div />`) gets the `role="link"`
   * fallback; a component (a router's Link) navigates itself, so the router is not called.
   */
  readonly render?: RenderProp<LinkState>
}

const noSubscription = () => () => {}
const clientOrigin = () => globalThis.location?.origin
const serverOrigin = () => undefined

/** The tag a `render` element will produce when it says so statically. */
const staticTag = (render: RenderProp<LinkState> | undefined) =>
  render === undefined
    ? "a"
    : isValidElement(render) && typeof render.type === "string"
      ? render.type
      : "a"

type Props = Readonly<Record<string, unknown>>

/** The part's own props from several modules: same-named handlers all run, in order. */
function joinHandlers(...sources: Props[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const prev = out[key]
      out[key] =
        typeof prev === "function" && typeof value === "function" && /^on[A-Z]/.test(key)
          ? (e: unknown) => {
              prev(e)
              value(e)
            }
          : value
    }
  }
  return out
}

/** A navigational link (openspec link, link-navigation). Stateless: no machine. */
export function Link(props: LinkProps) {
  const {
    href,
    target,
    rel,
    download,
    ping,
    referrerPolicy,
    hrefLang,
    routerOptions,
    disabled = false,
    focusableWhenDisabled,
    current,
    onActivate,
    render,
    id,
    ref,
    onClick,
    ...rest
  } = props
  const env = useEnvironment()
  const instance = useRootId(id)
  const el = useRef<HTMLElement | null>(null)
  const [tag, setTag] = useState(() => staticTag(render))
  useIsoLayoutEffect(() => {
    const node = el.current
    if (!node) return
    const actual = node.tagName.toLowerCase()
    if (actual !== tag) setTag(actual)
    warnLinkFallback(node)
    warnInteractiveContent(node, "link")
  })
  // Unknown on the server and while hydrating, so both renders agree on data-external.
  const origin = useSyncExternalStore(noSubscription, clientOrigin, serverOrigin)
  // A rendered component (a router's Link) navigates itself (react-spectrum#2525).
  const ownsNavigation = isValidElement(render) && typeof render.type !== "string"
  const linkEnv: LinkEnv = ownsNavigation ? { ...env, router: undefined } : env
  const input: LinkInput = {
    href,
    target,
    rel,
    download,
    ping,
    referrerPolicy,
    hrefLang,
    routerOptions,
    disabled,
    focusableWhenDisabled,
    current,
    onActivate,
    origin,
    tag,
  }
  const press = usePress({
    env,
    disabled: () => disabled,
    send: (e) => {
      // A native anchor activates through its own click; the fallback through the routine.
      if (e.type === "PRESS" && tag !== "a" && el.current)
        activateLink(input, el.current, e, linkEnv)
    },
  })
  const hover = useHover({ env, disabled: () => disabled, send: () => {} })
  // The tracker must see the pointerdown before focus, or a click looks like keyboard focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const part = linkConnect({ ...input, instance }, linkEnv)
  const own = normalizeProps({
    ...part,
    ...focusAttrs(focused, modality),
    "data-pressed": press.pressed ? "" : undefined,
    "data-hover": hover.hovered ? "" : undefined,
  })
  const partProps = joinHandlers(own, press.props, hover.props, {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })
  const merged = mergeProps(
    { ...partProps, ref: composeRefs(el, ref) },
    rest,
    // A disabled link drops the consumer's onClick (link-navigation "Disabled Links").
    disabled ? {} : { onClick },
  )
  const state: LinkState = {
    disabled,
    current: current !== undefined && current !== false,
    pressed: press.pressed,
    hovered: hover.hovered,
    focusVisible: own["data-focus-visible"] !== undefined,
  }
  return renderPart("a", merged, render, state)
}
