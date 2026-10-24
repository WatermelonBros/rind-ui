<script lang="ts">
import { toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { useCompositeHost, useHostItem } from "../composite-host.svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterItem } from "../use-collection-items.svelte"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import { groupContext, itemContext } from "./context"
import type { ToggleGroupGroupItemProps, ToggleGroupItemState } from "./types"

/** Enough state to read an item's id (the key the host knows it by). */
const NO_STATE = {
  tag: "button",
  itemDisabled: false,
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
} as const

const {
  value,
  disabled = false,
  textValue,
  child,
  children,
  ...rest
}: ToggleGroupGroupItemProps = $props()
const ctx = groupContext.get()
const env = useEnvironment()
// The modality tracker must see the pointerdown that comes before focus.
$effect(() => env.modality.subscribe(() => {}))
const key = $derived(toKey(value))
const el = elementRef("button")
useRegisterItem(
  ctx.registry,
  () => ({ key: value, textValue, disabled }),
  () => el.current,
)
// Read once, in document order: this item's view of the server tab stop.
const pendingStop = untrack(() => ctx.stop(value, ctx.disabled() || disabled, ctx.value()))
// Hosted: the item is also one of the host's controls (navigation and tab stop).
const host = useCompositeHost()
const hostKey = $derived(ctx.api().item(key, NO_STATE)["id"] as string) // set by the connect
const itemDisabled = $derived(ctx.disabled() || disabled)
useHostItem(
  host,
  () => ({ id: hostKey, skip: itemDisabled && !ctx.focusableWhenDisabled(), textValue }),
  () => el.current,
)
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "PRESS", key, modality: e.modality })
  },
  disabled: () => itemDisabled,
})
const hover = useHover({ env, send: () => {}, disabled: () => itemDisabled })
const current: ToggleGroupItemState = $derived({
  pressed: ctx.value().includes(key),
  disabled: itemDisabled,
})
itemContext.set({
  state: () => current,
  indicator: () =>
    normalizeProps(ctx.api(pendingStop).itemIndicator(key, { itemDisabled: disabled })),
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api(pendingStop).item(key, {
              tag: el.tag,
              itemDisabled: disabled,
              focused,
              modality: modality.current,
              pressed: press.pressed,
              hovered: hover.hovered,
            }),
          ),
          host
            ? normalizeProps(
                host.itemProps({
                  id: hostKey,
                  disabled: itemDisabled,
                  first: host.claimFirst(hostKey),
                }),
              )
            : {},
          press.props,
          hover.props,
          { onfocusin: () => (focused = true), onfocusout: () => (focused = false) },
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
