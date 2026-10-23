<script lang="ts">
import { Rating } from "@rind-ui/svelte"
</script>

<Rating.Root defaultValue={3}>
  <Rating.Label>Rate this recipe</Rating.Label>
  <Rating.Control>
    {#each [1, 2, 3, 4, 5] as index (index)}
      <Rating.Item {index} />
    {/each}
  </Rating.Control>
</Rating.Root>
