<script lang="ts">
import {
  activateLink,
  focusAttrs,
  type LinkInput,
  linkConnect,
  warnInteractiveContent,
  warnLinkFallback,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAnchorAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import type { LinkProps, LinkState } from "./types"

const {
  href,
  target,
  rel,
  download,
  ping,
  referrerpolicy,
  hreflang,
  routerOptions,
  disabled = false,
  focusableWhenDisabled,
  current,
  onActivate,
  id,
  onclick,
  child,
  children,
  ...rest
}: LinkProps = $props()

const uid = $props.id()
const env = useEnvironment()
const el = elementRef("a")
$effect(() => {
  const node = el.current
  if (!node) return
  warnLinkFallback(node)
  warnInteractiveContent(node, "link")
})
// Unknown on the server and while hydrating, so both renders agree on data-external.
let origin = $state<string | undefined>(undefined)
$effect(() => {
  origin = globalThis.location?.origin
  // The tracker must see the pointerdown before focus, or a click looks like keyboard focus.
  return env.modality.subscribe(() => {})
})
const input: LinkInput = $derived({
  href,
  target: target ?? undefined,
  rel: rel ?? undefined,
  download,
  ping: ping ?? undefined,
  referrerPolicy: (referrerpolicy ?? undefined) as LinkInput["referrerPolicy"],
  hrefLang: hreflang ?? undefined,
  routerOptions,
  disabled,
  focusableWhenDisabled,
  current,
  onActivate,
  origin,
  tag: el.tag,
})
const press = usePress({
  env,
  disabled: () => disabled,
  send: (e) => {
    // A native anchor activates through its own click; the fallback through the routine.
    if (e.type === "PRESS" && el.tag !== "a" && el.current) activateLink(input, el.current, e, env)
  },
})
const hover = useHover({ env, disabled: () => disabled, send: () => {} })
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const focus = $derived(focusAttrs(focused, modality.current))
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps({
            ...linkConnect({ ...input, instance: id ?? uid }, env),
            ...focus,
            "data-pressed": press.pressed ? "" : undefined,
            "data-hover": hover.hovered ? "" : undefined,
          }),
          press.props,
          hover.props,
          { onfocusin: () => (focused = true), onfocusout: () => (focused = false) },
        ),
        ...(id === undefined ? {} : { id }),
        ...el.props,
      },
      rest,
      // A disabled link drops the consumer's onclick (link-navigation "Disabled Links").
      disabled ? {} : { onclick },
    ),
  ),
)
const linkState: LinkState = $derived({
  disabled,
  current: current !== undefined && current !== false,
  pressed: press.pressed,
  hovered: hover.hovered,
  focusVisible: focus["data-focus-visible"] !== undefined,
})
</script>

{#if child}
  {@render child({ props: merged, state: linkState })}
{:else}
  <!-- Connect's props are the anchor's attributes and handlers. -->
  <a {...merged as HTMLAnchorAttributes}>{@render children?.(linkState)}</a>
{/if}
