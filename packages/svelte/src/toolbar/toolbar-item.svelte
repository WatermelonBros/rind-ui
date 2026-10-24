<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useControl } from "./host.svelte"
import type { ToolbarItemProps } from "./types"

const TEXT_TAGS = new Set(["input", "textarea"])

const { id, disabled = false, focusableWhenDisabled, child, ...rest }: ToolbarItemProps = $props()
const uid = $props.id()
const c = useControl("Item", uid, () => ({
  id: id ?? undefined,
  disabled,
  focusable: focusableWhenDisabled,
}))
const merged = $derived.by(() => {
  const disabledProps = !c.disabled()
    ? {}
    : c.keepsFocus()
      ? // Focusable while disabled: announced, and a text field takes no input (base-ui#5366).
        { "aria-disabled": "true", ...(TEXT_TAGS.has(c.el.tag) ? { readonly: true } : {}) }
      : { disabled: true }
  return stripMarker(
    mergeProps(
      {
        ...normalizeProps({ ...c.roving(), ...c.host.api.part("item", c.id()) }),
        ...disabledProps,
        id: c.id(),
        ...c.el.props,
      },
      rest,
    ),
  )
})
const current = $derived({ disabled: c.disabled() })
</script>

{@render child({ props: merged, state: current })}
