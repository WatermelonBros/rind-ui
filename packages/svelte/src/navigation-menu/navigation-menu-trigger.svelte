<script lang="ts">
import { watchFieldsetDisabled } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import { navItem, navLevel, navPanel } from "./context.svelte"
import type { NavigationMenuTriggerProps } from "./types"

// The disclosure button that toggles the item's panel.
const { disabled: own = false, child, children, ...rest }: NavigationMenuTriggerProps = $props()
const ctx = navLevel.get()
const item = navItem.get()
const panel = navPanel.maybe() ?? null
const env = useEnvironment()
// rind's Fieldset and a native <fieldset disabled> disable it too (button-like-element).
const fieldsetDisabled = useFieldsetDisabled()
let fieldsetDom = $state(false)
const disabled = $derived(own === true || ctx.disabled() || fieldsetDisabled() || fieldsetDom)
$effect(() => {
  const d = disabled
  untrack(() => {
    ctx.disabledItems.set(item.key, d)
    if (d) ctx.service.send({ type: "DISABLED" })
  })
  return () => {
    ctx.disabledItems.delete(item.key)
  }
})
// The modality tracker needs a subscriber while the trigger is mounted.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") ctx.api().press(item.key, e.modality)
  },
  disabled: () => disabled,
})
const hover = useHover({ env, disabled: () => disabled, send: () => {} })
// Stable for the trigger's life: the handlers remember whether the pointer is on it.
const intent = ctx.hoverIntent.triggerProps((e) =>
  ctx.service.send({ type: e.type, item: item.key }),
)
const el = elementRef("button")
$effect(() => {
  const node = el.current
  if (!node) return
  const watch = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
  fieldsetDom = watch.disabled
  return watch.stop
})
const merged = $derived.by(() => {
  const props = normalizeProps(
    ctx.api().trigger(item.key, {
      focused,
      modality: modality.current,
      pressed: press.pressed,
      hovered: hover.hovered,
      tag: el.tag,
      disabled,
      current: ctx.shared.current.has(item.key),
      contentMounted: item.shared.contentMounted,
      inPanel: panel !== null,
    }),
  )
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          props,
          press.props,
          hover.props,
          normalizeProps({
            onPointerMove: intent.onPointerMove,
            onPointerLeave: intent.onPointerLeave,
          }),
          {
            onfocus: () => {
              focused = true
            },
            onblur: () => {
              focused = false
            },
          },
        ),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({ open: ctx.value() === item.key })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
