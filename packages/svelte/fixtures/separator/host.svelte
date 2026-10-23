<script lang="ts">
import { Separator, type SeparatorHost, separatorHost } from "../../src/index"

const { host, items }: { host: SeparatorHost; items: Record<string, unknown>[] } = $props()
separatorHost.set(() => host)
</script>

{#each items as item, i (i)}
  <Separator.Root {...item} />
{/each}
