<script lang="ts">
import { toggleMachine } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { menuApi, menuItemState, menuLevel, useItem } from "./context.svelte"
import type { MenuCheckboxItemProps } from "./types"

let {
  value,
  textValue,
  disabled = false,
  closeOnSelect = false,
  checked = $bindable(),
  defaultChecked,
  onCheckedChange,
  onSelect,
  child,
  children,
  ...rest
}: MenuCheckboxItemProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const uid = $props.id()
const toggle = useMachine(toggleMachine, () => ({
  pressed: checked,
  defaultPressed: defaultChecked,
  onPressedChange: (p: boolean) => {
    onCheckedChange?.(p)
    if (checked !== undefined) checked = p
  },
}))
const on = $derived(toggle.view.values.pressed === true)
menuItemState.set({ checked: () => on })
const el = elementRef("div")
const key = useItem(
  ctx,
  () => ({ value, textValue, disabled }),
  () => ({
    onSelect,
    activate: (a) =>
      toggle.send({
        type: "PRESS",
        modality: a.modality,
        pointerType: a.modality === "pointer" ? "mouse" : a.modality,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
  }),
  () => el.current,
  uid,
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          menuApi(ctx, env).item(key(), {
            kind: "checkbox-item",
            disabled,
            closeOnSelect,
            checked: on,
          }),
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current = $derived({ highlighted: ctx.view().context.highlightedKey === key(), disabled })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
