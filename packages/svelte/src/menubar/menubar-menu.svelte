<script lang="ts">
import {
  type MenuChangeDetails,
  type MenuCloseReason,
  positioningPresets,
  toKey,
} from "@rind-ui/core"
import { menuHost } from "../menu/context.svelte"
import MenuRoot from "../menu/menu-root.svelte"
import { levelOf, menubar, menubarEntry } from "./context"
import Handle from "./menubar-handle.svelte"
import type { MenubarMenuProps } from "./types"

const { value, disabled = false, positioning, children, ...rest }: MenubarMenuProps = $props()
const bar = menubar.get()
const key = $derived(toKey(value))
menubarEntry.set({ key: () => key, disabled: () => disabled })
menuHost.set({
  parentKind: "menubar",
  key: () => key,
  host: {
    elements: () => {
      const root = bar.root()
      return root instanceof HTMLElement ? [root] : []
    },
    navigate: ({ direction }) => {
      if (bar.orientation() === "vertical") {
        if (direction === "collapse") bar.send({ type: "MENU_NAVIGATE", from: key, direction })
        return
      }
      const next = direction === "expand" ? "next" : "previous"
      bar.send({ type: "MENU_NAVIGATE", from: key, direction: next })
    },
    press: (k, modality) => bar.send({ type: "TRIGGER_PRESS", key: k, modality }),
  },
})
const placed = $derived(
  bar.orientation() === "vertical"
    ? { ...positioningPresets.submenu, ...positioning }
    : positioning,
)
const onOpenChange = (open: boolean, details: MenuChangeDetails) => {
  // The bar's own closes (switching, its item pressed) are already in its value.
  if (open) return
  if (bar.closing.delete(key)) return
  bar.send({ type: "MENU_CLOSED", key, reason: details.reason as MenuCloseReason })
}
</script>

<MenuRoot {...rest} id={levelOf(bar.instance(), key)} modal={bar.modal()} positioning={placed} {onOpenChange}
  ><Handle />{@render children?.()}</MenuRoot
>
