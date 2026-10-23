<script lang="ts">
import { Skeleton } from "@rind-ui/svelte"
</script>

<Skeleton.Root loading>
  <Skeleton.Status />
  <Skeleton.Content class="stack">
    <div class="row">
      <Skeleton.Item data-shape="circle">
        <span aria-hidden="true">AL</span>
      </Skeleton.Item>
      <Skeleton.Item>Ada Lovelace</Skeleton.Item>
    </div>
    <Skeleton.Item>
      The analytical engine weaves algebraic patterns just as the Jacquard loom weaves flowers and
      leaves.
    </Skeleton.Item>
  </Skeleton.Content>
</Skeleton.Root>
