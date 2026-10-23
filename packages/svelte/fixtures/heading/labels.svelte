<script lang="ts">
import { Label } from "../../src/index"

const { wrap = false }: { wrap?: boolean } = $props()
</script>

{#if wrap}
  <Label>Name <input /></Label>
{:else}
  <div><Label for="n">Name</Label><input id="n" /></div>
{/if}
