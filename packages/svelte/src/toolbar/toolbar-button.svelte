<script lang="ts">
import Button from "../button/button.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useControl } from "./host.svelte"
import type { ToolbarButtonProps } from "./types"

const { id, disabled = false, focusableWhenDisabled, ...rest }: ToolbarButtonProps = $props()
const uid = $props.id()
const c = useControl("Button", uid, () => ({
  id: id ?? undefined,
  disabled,
  focusable: focusableWhenDisabled,
}))
const merged = $derived(
  mergeProps(
    { ...normalizeProps({ ...c.roving(), ...c.host.api.part("button", c.id()) }), ...c.el.props },
    rest,
  ),
)
</script>

<Button {...merged} id={c.id()} disabled={c.disabled()} focusableWhenDisabled={c.keepsFocus()} />
