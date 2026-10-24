<script lang="ts">
import { elementRef } from "../element-ref.svelte"
import MenuTrigger from "../menu/menu-trigger.svelte"
import type { MenuTriggerProps } from "../menu/types"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useRegisterItem } from "../use-collection-items.svelte"
import { menubar, menubarEntry } from "./context"
import type { MenubarTriggerProps } from "./types"

const { textValue, child, children, ...rest }: MenubarTriggerProps = $props()
const bar = menubar.get()
const entry = menubarEntry.maybe()
if (!entry) throw new Error("Menubar.Trigger must be inside Menubar.Menu")
const disabled = $derived(bar.disabled() || entry.disabled())
const el = elementRef("div")
useRegisterItem(
  bar.registry,
  () => ({ key: entry.key(), textValue, disabled }),
  () => el.current,
)
const merged = $derived.by(() => {
  const first = bar.claimFirst(entry.key())
  const own = normalizeProps(bar.api().item({ key: entry.key(), disabled, first }))
  return mergeProps({ ...own, ...el.props }, rest)
})
</script>

<!-- Sound: Menu.Trigger renders a div in menubar mode; its props are the div's. -->
<MenuTrigger {...merged as MenuTriggerProps} {disabled} {child} {children} />
