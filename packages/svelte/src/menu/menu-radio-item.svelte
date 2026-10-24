<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { menuApi, menuItemState, menuLevel, menuRadioGroup, useItem } from "./context.svelte"
import type { MenuRadioItemProps } from "./types"

const {
  value,
  textValue,
  disabled: ownDisabled = false,
  closeOnSelect = false,
  onSelect,
  child,
  children,
  ...rest
}: MenuRadioItemProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const group = menuRadioGroup.maybe()
if (!group) throw new Error("Menu.RadioItem must be inside Menu.RadioGroup")
const uid = $props.id()
const disabled = $derived(ownDisabled || group.disabled())
const checked = $derived(group.value() === value)
menuItemState.set({ checked: () => checked })
const el = elementRef("div")
const key = useItem(
  ctx,
  () => ({ value, textValue, disabled }),
  () => ({ onSelect, activate: () => group.select(value) }),
  () => el.current,
  uid,
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          menuApi(ctx, env).item(key(), { kind: "radio-item", disabled, closeOnSelect, checked }),
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
