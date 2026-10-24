/** @jsxImportSource solid-js */
import {
  activateLink,
  focusAttrs,
  type Href,
  type LinkCurrent,
  type LinkInput,
  linkConnect,
  type RouterOptions,
  warnInteractiveContent,
  warnLinkFallback,
} from "@rind-ui/core"
import { createEffect, createMemo, createSignal, type JSX, onCleanup, splitProps } from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

export interface LinkState {
  readonly disabled: boolean
  readonly current: boolean
  readonly pressed: boolean
  readonly hovered: boolean
  readonly focusVisible: boolean
}

type AnchorAttributes = JSX.AnchorHTMLAttributes<HTMLAnchorElement>

export type LinkProps = Omit<AnchorAttributes, "href" | "download" | "children"> & {
  /** Typed by `RouterConfig` (augmentable). */
  readonly href?: Href | undefined
  /** Download instead of navigating (the browser handles it); a string names the file. */
  readonly download?: boolean | string | undefined
  /** Passed unchanged to the router's `navigate`. */
  readonly routerOptions?: RouterOptions | undefined
  /** No `href`, `aria-disabled`, out of the Tab order (unless `focusableWhenDisabled`); nothing navigates. */
  readonly disabled?: boolean | undefined
  /** Keeps a disabled link in the Tab order (it stays `aria-disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Sets `aria-current` and `data-current`; the link still navigates. */
  readonly current?: LinkCurrent | undefined
  /** Once per activation that is not disabled or prevented, with where it opened. */
  readonly onActivate?: LinkInput["onActivate"] | undefined
  /** Renders another element with the part's props (spread them on it). */
  readonly render?: RenderProp<LinkState> | undefined
  readonly children?: JSX.Element | ((state: LinkState) => JSX.Element)
}

/** A navigational link (openspec link, link-navigation). Stateless: no machine. */
export function Link(props: LinkProps) {
  const [local, rest] = splitProps(props, [
    "href",
    "target",
    "rel",
    "download",
    "ping",
    "referrerpolicy",
    "hreflang",
    "routerOptions",
    "disabled",
    "focusableWhenDisabled",
    "current",
    "onActivate",
    "render",
    "id",
    "onClick",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => local.id)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "a") : "a")
  const disabled = () => local.disabled === true
  afterMount(() => {
    createEffect(() => {
      const node = el()
      if (!node) return
      warnLinkFallback(node)
      warnInteractiveContent(node, "link")
    })
    // The tracker must see the pointerdown before focus, or a click looks like keyboard focus.
    onCleanup(env.modality.subscribe(() => {}))
  })
  // Unknown on the server and while hydrating, so both renders agree on data-external.
  const [origin, setOrigin] = createSignal<string | undefined>(undefined)
  afterMount(() => setOrigin(globalThis.location?.origin))
  const input = createMemo(
    (): LinkInput => ({
      href: local.href,
      target: local.target,
      rel: local.rel,
      download: local.download,
      ping: local.ping,
      // The attribute's own union is the one LinkInput names.
      referrerPolicy: local.referrerpolicy as LinkInput["referrerPolicy"],
      hrefLang: local.hreflang,
      routerOptions: local.routerOptions,
      disabled: disabled(),
      focusableWhenDisabled: local.focusableWhenDisabled,
      current: local.current,
      onActivate: local.onActivate,
      origin: origin(),
      tag: tag(),
    }),
  )
  const press = usePress({
    env,
    disabled,
    send: (e) => {
      // A native anchor activates through its own click; the fallback through the routine.
      const node = el()
      if (e.type === "PRESS" && tag() !== "a" && node) activateLink(input(), node, e, env)
    },
  })
  const hover = useHover({ env, disabled, send: () => {} })
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const focus = createMemo(() => focusAttrs(focused(), modality()))
  const own = createMemo(() =>
    normalizeProps({
      ...linkConnect({ ...input(), instance: instance() }, env),
      ...focus(),
      "data-pressed": press.pressed() ? "" : undefined,
      "data-hover": hover.hovered() ? "" : undefined,
    }),
  )
  const consumerClick = () => {
    const handler = local.onClick
    if (Array.isArray(handler)) return (e: MouseEvent) => handler[0](handler[1], e)
    return handler
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(own(), press.props, hover.props, {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
      // A disabled link drops the consumer's onClick (link-navigation "Disabled Links").
      disabled() || consumerClick() === undefined ? {} : { onClick: consumerClick() },
    ),
  )
  const state = reactive<LinkState>(() => ({
    disabled: disabled(),
    current: local.current !== undefined && local.current !== false,
    pressed: press.pressed(),
    hovered: hover.hovered(),
    focusVisible: own()["data-focus-visible"] !== undefined,
  }))
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <a {...p}>{children()}</a>)
}
