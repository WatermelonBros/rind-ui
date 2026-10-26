<script lang="ts">
import { focusSafely, labelInteraction } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { radioGroupContext, radioItemContext } from "./context"
import type { RadioGroupItemLabelProps } from "./types"

const { child, children, ...rest }: RadioGroupItemLabelProps = $props()
const ctx = radioGroupContext.get()
const item = radioItemContext.get()
$effect(() =>
  untrack(() => {
    item.setLabelRendered(true)
    return () => item.setLabelRendered(false)
  }),
)
const env = useEnvironment()
const labelable = () => item.controlTag() === "button" || item.controlTag() === "input"
// A non-labelable control (a substituted element): a press on the label focuses and checks it
// (spec "Activation"), with the double-click text-selection guard.
const interaction = normalizeProps(
  labelInteraction(env, {
    target: () => item.controlEl.current as HTMLElement | null,
    forwardsFocus: () => !labelable(),
    focusTarget: () => {
      const control = item.controlEl.current as HTMLElement | null
      if (control) void focusSafely(control, env, "programmatic")
      if (!item.disabled())
        ctx.send({ type: "PRESS", key: item.key(), modality: env.modality.modality() })
    },
  }),
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          ctx.api().itemLabel(item.key(), { disabled: item.disabled(), labelable: labelable() }),
        ),
        ...interaction,
      },
      rest,
    ),
  ),
)
const current = $derived({ checked: ctx.value() === item.key(), disabled: item.disabled() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <label {...attrs(merged)}>{@render children?.(current)}</label>
{/if}
