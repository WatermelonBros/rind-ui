<script lang="ts">
import { type LayerMeta, menuIds, menuLevelId, toKey } from "@rind-ui/core"
import { menuLevel, menuSubmenu, useMenuLevelService } from "./context.svelte"
import type { MenuSubmenuProps } from "./types"

const {
  loop,
  focusableWhenDisabled,
  typeaheadTimeout,
  positioning,
  submenuOpenDelay,
  submenuGraceTimeout,
  children,
}: MenuSubmenuProps = $props()
const parent = menuLevel.get()
const uid = $props.id()
const levelId = menuLevelId(uid)
const key = toKey(`${levelId}-trigger`)
const shared = $state({
  trigger: null as HTMLElement | null,
  contentMounted: false,
  meta: undefined as LayerMeta | undefined,
})
const s = useMenuLevelService({
  level: "submenu",
  levelId,
  parentLevel: parent.levelId,
  tree: parent.tree,
  shared,
  options: () => ({
    loop,
    focusableWhenDisabled,
    typeaheadTimeout,
    positioning,
    submenuOpenDelay,
    submenuGraceTimeout,
  }),
  hoverIntent: parent.hoverIntent,
})
const disabled = { current: false }
$effect(() => {
  parent.submenus.set(key, () => {
    if (!disabled.current) s.send({ type: "SUB_OPEN" })
  })
  return () => {
    parent.submenus.delete(key)
  }
})
menuSubmenu.set({ parent, key, shared, disabled })
menuLevel.set({
  service: s.service,
  view: s.view,
  levelId,
  level: "submenu",
  props: s.props,
  tree: parent.tree,
  keepMounted: parent.keepMounted,
  registry: s.registry,
  activations: s.activations,
  submenus: s.submenus,
  hoverIntent: s.hoverIntent,
  shared,
  labelledBy: menuIds(parent.levelId).item(key),
  inMenubar: false,
})
</script>

{@render children?.()}
