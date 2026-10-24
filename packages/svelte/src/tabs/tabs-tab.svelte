<script lang="ts">
import { toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterItem } from "../use-collection-items.svelte"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import { tabsContext } from "./context"
import type { TabsTabProps } from "./types"

const { value, disabled = false, textValue, child, children, ...rest }: TabsTabProps = $props()
const ctx = tabsContext.get()
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
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const isDisabled = () => ctx.disabled() || disabled
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "PRESS", key, modality: e.modality })
  },
  disabled: isDisabled,
})
const hover = useHover({ env, send: () => {}, disabled: isDisabled })
// Read once, in document order: this tab's view of the server tab stop.
const pendingStop = untrack(() => {
  ctx.declared.push(value)
  return ctx.stop(value, isDisabled(), ctx.value() === null ? [] : [ctx.value() as string])
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api(pendingStop).tab(key, {
              tag: el.tag,
              itemDisabled: disabled,
              focused,
              modality: modality.current,
              pressed: press.pressed,
              hovered: hover.hovered,
            }),
          ),
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
const current = $derived({ selected: ctx.value() === key, disabled: isDisabled() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
