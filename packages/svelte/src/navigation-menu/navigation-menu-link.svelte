<script lang="ts">
import { untrack } from "svelte"
import Link from "../link/link.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { navLevel, navPanel } from "./context.svelte"
import type { NavigationMenuLinkProps } from "./types"

// A link: `current` marks the page; a same-tab activation closes every open level.
const { onActivate, current, ...rest }: NavigationMenuLinkProps = $props()
const ctx = navLevel.get()
const panel = navPanel.maybe() ?? null
const on = $derived(current !== undefined && current !== false)
// The current page marks the trigger of every panel the link is in, outermost included.
const chain: { readonly item: string; readonly mark: (key: string, on: boolean) => void }[] = []
for (let p = panel; p; p = p.parent) chain.push({ item: p.item, mark: p.level.markCurrent })
$effect(() => {
  if (!on) return
  untrack(() => {
    for (const c of chain) c.mark(c.item, true)
  })
  return () => {
    for (const c of chain) c.mark(c.item, false)
  }
})
// Arrow keys find the link by its id.
const uid = $props.id()
const merged = $derived(
  mergeProps(
    {
      ...normalizeProps(ctx.api().link({ inPanel: panel !== null })),
      id: `${ctx.root()}-link-${uid}`,
    },
    rest,
  ),
)
</script>

<Link
  {...merged as typeof rest}
  {...current === undefined ? {} : { current }}
  onActivate={(details) => {
    onActivate?.(details)
    if (details.disposition === "same-tab") ctx.level.closeTree()
  }}
/>
