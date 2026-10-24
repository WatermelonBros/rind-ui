<script lang="ts">
import { menuRadioGroupMachine } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { menuApi, menuLevel, menuRadioGroup } from "./context.svelte"
import type { MenuRadioGroupProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  disabled = false,
  child,
  children,
  ...rest
}: MenuRadioGroupProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const group = useMachine(menuRadioGroupMachine, () => ({
  value,
  defaultValue,
  onValueChange: (v: string | null) => {
    onValueChange?.(v)
    if (value !== undefined) value = v
  },
  disabled,
}))
menuRadioGroup.set({
  value: () => group.view.values.value ?? null,
  select: (v) => group.send({ type: "SELECT", value: v }),
  disabled: () => disabled,
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(menuApi(ctx, env).radioGroup({ disabled })), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
