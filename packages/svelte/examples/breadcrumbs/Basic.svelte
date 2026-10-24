<script lang="ts">
import { Breadcrumbs } from "@rind-ui/svelte"

const crumbs: readonly { label: string; href?: string }[] = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs/" },
  { label: "Breadcrumbs" },
]
</script>

<Breadcrumbs.Root>
  <Breadcrumbs.List>
    {#each crumbs as c (c.label)}
      <Breadcrumbs.Item value={c.label}>
        <Breadcrumbs.Link href={c.href}>{c.label}</Breadcrumbs.Link>
        <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
      </Breadcrumbs.Item>
    {/each}
  </Breadcrumbs.List>
</Breadcrumbs.Root>
