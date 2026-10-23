<script lang="ts">
import { focusSafely, labelInteraction, warnOwnLabelInField } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLLabelAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterPart } from "../use-ids.svelte"
import { formToggleContext, stateOf, useApi } from "./context.svelte"
import type { FormToggleLabelProps } from "./types"

const { child, children, ...rest }: FormToggleLabelProps = $props()
const ctx = formToggleContext.get()
const env = useEnvironment()
useRegisterPart(ctx.registry, "label", () => ctx.ids().label)
const apiFor = useApi(ctx)
// An own Label inside a Field: the Field's names the control.
const inField = ctx.binding !== null
$effect(() =>
  untrack(() => {
    if (inField) warnOwnLabelInField(ctx.config.scope)
  }),
)
const interaction = normalizeProps(
  labelInteraction(env, {
    target: () => ctx.controlEl.current,
    forwardsFocus: () => !(ctx.controlTag() === "button" || ctx.controlTag() === "input"),
    // The non-labelable fallback: focus the control and toggle it once.
    focusTarget: () => {
      const control = ctx.controlEl.current
      if (control instanceof HTMLElement) void focusSafely(control, env, "programmatic")
      ctx.service.send({ type: "TOGGLE", modality: env.modality.modality() })
    },
  }),
)
const api = $derived(apiFor())
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(api.label()),
        // Inside a Field the Field's Label names the control: this one must not as well.
        ...(inField ? { for: undefined } : {}),
        ...interaction,
      },
      rest,
    ),
  ),
)
const current = $derived(stateOf(ctx, api))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the label's attributes and handlers. -->
  <label {...merged as HTMLLabelAttributes}>{@render children?.(current)}</label>
{/if}
