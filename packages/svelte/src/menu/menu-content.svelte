<script lang="ts">
import { menuLayerId, warnMenuInMenubar } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { provideLayer } from "../layer-context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePresence } from "../use-presence.svelte"
import { isOpen, menuApi, menuLevel } from "./context.svelte"
import type { MenuContentProps } from "./types"

/** Controls keep their own role inside the menu (a search field, a native button). */
const INTERACTIVE = "input, select, textarea, button, a[href], [tabindex], [contenteditable]"

const {
  "aria-label": label,
  "aria-labelledby": labelledBy,
  child,
  children,
  ...rest
}: MenuContentProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
// Layers opened from here (submenus, dialogs from items) are this level's children.
provideLayer(
  () => menuLayerId(ctx.levelId),
  () => "menu",
)
const el = elementRef("div")
const open = $derived(isOpen(ctx))
const presence = usePresence(
  () => open,
  () => el.current,
  { keepMounted: ctx.keepMounted },
)
$effect(() => {
  const node = presence.mounted ? el.current : null
  untrack(() => {
    ctx.shared.contentMounted = node !== null
  })
  return () => {
    ctx.shared.contentMounted = false
  }
})
// Any other element directly inside the menu is presentational for the menu role.
$effect(() => {
  void children
  void open
  if (el.current) warnMenuInMenubar(el.current)
  for (const c of el.current?.children ?? []) {
    if (!c.hasAttribute("data-scope") && !c.hasAttribute("role") && !c.matches(INTERACTIVE)) {
      c.setAttribute("role", "none")
    }
  }
})
const exiting = $derived(!open && presence.state === "exiting")
// The scroll lock writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        {
          ...normalizeProps(
            menuApi(ctx, env).content({
              label: label ?? undefined,
              labelledBy: labelledBy ?? undefined,
            }),
          ),
          hidden: !open && !exiting && ctx.keepMounted(),
          ...(exiting ? { inert: true } : {}),
          ...el.props,
        },
        rest,
      ),
    ),
  ),
)
const current = $derived({ open })
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: current })}
  {:else}
    <div {...attrs(merged)}>{@render children?.(current)}</div>
  {/if}
{/if}
