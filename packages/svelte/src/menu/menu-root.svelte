<script lang="ts">
import { createMenuTree, type LayerMeta, type MenuChangeDetails, menuLevelId } from "@rind-ui/core"
import { untrack } from "svelte"
import { isOpen, type MenuLevel, menuHost, menuLevel, useMenuLevelService } from "./context.svelte"
import type { MenuRootProps } from "./types"

let {
  id,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  modal = true,
  keepMounted = false,
  actions = $bindable(),
  loop,
  focusableWhenDisabled,
  typeaheadTimeout,
  positioning,
  submenuOpenDelay,
  submenuGraceTimeout,
  children,
}: MenuRootProps = $props()
const uid = $props.id()
const levelId = menuLevelId(untrack(() => id ?? uid))
const host = menuHost.maybe() ?? null
const tree = createMenuTree({
  ...(host ? { parentKind: host.parentKind } : {}),
  ...(host?.host ? { host: host.host } : {}),
})
const shared = $state({
  trigger: null as HTMLElement | null,
  contentMounted: false,
  meta: undefined as LayerMeta | undefined,
})
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
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && open !== undefined) open = next
    },
    modal,
  }),
})
untrack(() => {
  actions = { open: () => s.send({ type: "OPEN" }), close: () => s.send({ type: "CLOSE" }) }
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
  inMenubar: host?.parentKind === "menubar",
}
menuLevel.set(ctx)
</script>

{@render children?.({ open: isOpen(ctx) })}
