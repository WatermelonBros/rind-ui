<script lang="ts">
import { Pagination } from "../../src/index"

const props: Record<string, unknown> = $props()
</script>

<Pagination.Root {...(props as { totalPages: number })}>
  {#snippet children(state)}
    <Pagination.List><Pagination.Item type="trigger"><Pagination.First /></Pagination.Item><Pagination.Item type="trigger"><Pagination.Previous /></Pagination.Item>{#each state.pages as e (e.key)}{#if e.type === "page"}<Pagination.Item><Pagination.Page value={e.value} /></Pagination.Item>{:else}<Pagination.Item type="ellipsis"><Pagination.Ellipsis position={e.position} /></Pagination.Item>{/if}{/each}<Pagination.Item type="trigger"><Pagination.Next /></Pagination.Item><Pagination.Item type="trigger"><Pagination.Last /></Pagination.Item></Pagination.List>
  {/snippet}
</Pagination.Root>
