<script lang="ts">
import {
  contextMenuMessages,
  createMenuTree,
  type LayerMeta,
  type MenuChangeDetails,
  type MenuPoint,
  menuIds,
  menuLevelId,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { type MenuLevel, menuLevel, useMenuLevelService } from "../menu/context.svelte"
import { useMessages } from "../provider"
import { contextMenuRegion } from "./context"
import type { ContextMenuRootProps } from "./types"

let {
  id,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  onAnchorChange,
  modal = true,
  disabled = false,
  longPress = true,
  longPressDelay = 500,
  keepMounted = false,
  messages: ownMessages,
  actions = $bindable(),
  loop,
  focusableWhenDisabled,
  typeaheadTimeout,
  positioning,
  submenuOpenDelay,
  submenuGraceTimeout,
  children,
}: ContextMenuRootProps = $props()
const uid = $props.id()
const levelId = menuLevelId(untrack(() => id ?? uid))
const messages = useMessages("context-menu", contextMenuMessages, () => ownMessages)
const tree = createMenuTree({ parentKind: "context-menu" })
const shared = $state({
  trigger: null as HTMLElement | null,
  contentMounted: false,
  meta: undefined as LayerMeta | undefined,
})
const detailsOf = (d: MenuChangeDetails) => {
  const e = d.event as { point?: MenuPoint; target?: Element | null; nativeEvent?: Event }
  return {
    ...d,
    point: e.point ?? null,
    target: e.target ?? null,
    nativeEvent: e.nativeEvent ?? null,
  }
}
const s = useMenuLevelService({
  level: "root",
  levelId,
  tree,
  shared,
  options: () => ({
    loop,
    focusableWhenDisabled,
    typeaheadTimeout,
    positioning,
    submenuOpenDelay,
    submenuGraceTimeout,
  }),
  controllable: () => ({
    open,
    defaultOpen,
    onOpenChange: (next: boolean, details: MenuChangeDetails) => {
      let cancelled = false
      onOpenChange?.(next, {
        ...detailsOf(details),
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && open !== undefined) open = next
    },
    modal,
  }),
  region: () => ({ onAnchorChange }),
})
untrack(() => {
  actions = {
    openAt: (point, target = null) => s.send({ type: "OPEN_AT", point, target }),
    close: () => s.send({ type: "CLOSE" }),
  }
})
const isOpen = $derived(s.view().matches("open"))
// Development: a controlled open with no gesture anchors at the region's corner.
$effect(() => {
  if (!DEV || open !== true) return
  if (s.service.getSnapshot().context.regionAnchor === null) {
    console.warn(
      `[rind-ui] context-menu ${levelId}: opened without a point; it is placed at the region's top-left corner (use the actions' openAt)`,
    )
  }
})
// Development: the menu needs a name of its own (no trigger text names it).
$effect(() => {
  if (!DEV || !isOpen) return
  const content = document.getElementById(menuIds(levelId).content)
  if (content && !content.getAttribute("aria-label") && !content.getAttribute("aria-labelledby")) {
    console.warn(
      `[rind-ui] context-menu ${levelId}: the menu has no accessible name; pass aria-label to Menu.Content`,
    )
  }
})
const ctx: MenuLevel = {
  service: s.service,
  view: s.view,
  levelId,
  level: "root",
  props: s.props,
  tree,
  keepMounted: () => keepMounted,
  registry: s.registry,
  activations: s.activations,
  submenus: s.submenus,
  hoverIntent: s.hoverIntent,
  shared,
  inMenubar: false,
  region: true,
}
menuLevel.set(ctx)
contextMenuRegion.set({
  disabled: () => disabled,
  longPress: () => longPress,
  longPressDelay: () => longPressDelay,
  messages,
})
</script>

{@render children?.({ open: isOpen })}
