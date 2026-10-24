<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterPart } from "../use-ids.svelte"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import { collapsibleContext, stateOf, useApi } from "./service.svelte"
import type { CollapsibleTriggerProps } from "./types"

const { id, child, children, ...rest }: CollapsibleTriggerProps = $props()
const ctx = collapsibleContext.get()
// A consumer id is the id the content's aria-labelledby references (an Accordion region).
const ownId = $derived(id ?? partId(ctx.scope, ctx.idBase(), "trigger"))
$effect.pre(() => {
  ctx.triggerId.current = id ?? undefined
})
untrack(() => {
  ctx.triggerId.current = id ?? undefined
})
useRegisterPart(ctx.registry, "trigger", () => ownId)
const env = useEnvironment()
$effect(() => env.modality.subscribe(() => {}))
const el = elementRef("button")
$effect(() => {
  ctx.triggerEl.current = el.current
})
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  disabled: () => ctx.disabled(),
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "TOGGLE", modality: e.modality })
  },
})
const hover = useHover({ env, send: () => {}, disabled: () => ctx.disabled() })
const apiFor = useApi(ctx)
const merged = $derived.by(() => {
  const api = apiFor({
    triggerFocused: focused,
    modality: modality.current,
    pressed: press.pressed,
    hovered: hover.hovered,
    triggerTag: el.tag,
  })
  const own = normalizeProps({ ...api.trigger(), ...ctx.decoration.trigger?.(), id: ownId })
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, press.props, hover.props, {
          onfocusin: () => (focused = true),
          onfocusout: () => (focused = false),
        }),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
