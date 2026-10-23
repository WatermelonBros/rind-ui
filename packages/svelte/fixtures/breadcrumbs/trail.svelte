<script lang="ts">
import { Breadcrumbs } from "../../src/index"

interface Crumb {
  readonly value: string
  readonly label: string
  readonly href?: string
  readonly current?: boolean
}
const { crumbs, root = {} }: { crumbs: readonly Crumb[]; root?: Record<string, unknown> } = $props()
</script>

<Breadcrumbs.Root {...root}>
  <Breadcrumbs.List>
    {#each crumbs as c, i (c.value)}<Breadcrumbs.Item value={c.value} {...c.current === undefined ? {} : { current: c.current }}><Breadcrumbs.Link {...c.href ? { href: c.href } : {}}>{c.label}</Breadcrumbs.Link><Breadcrumbs.Separator>/</Breadcrumbs.Separator></Breadcrumbs.Item>{#if i === 0}<Breadcrumbs.Ellipsis>{#snippet children({ label })}<button type="button" aria-label={label}>…</button>{/snippet}</Breadcrumbs.Ellipsis>{/if}{/each}
  </Breadcrumbs.List>
</Breadcrumbs.Root>
