<script lang="ts">
import { Skeleton } from "../../src/index"

const {
  wrap = false,
  ...props
}: { wrap?: boolean; loading?: boolean; announceOnLoad?: boolean | string; animate?: boolean } =
  $props()
</script>

<section aria-label="Comments">
  <Skeleton.Root {...props}>
    <Skeleton.Status />
    <Skeleton.Content>
      {#snippet child({ props: p })}
        <ul {...p}>
          <li><Skeleton.Item /></li>
          <li>
            {#if wrap}
              <Skeleton.Item><button type="button">Reply</button></Skeleton.Item>
            {:else}
              <Skeleton.Item />
            {/if}
          </li>
        </ul>
      {/snippet}
    </Skeleton.Content>
  </Skeleton.Root>
</section>
