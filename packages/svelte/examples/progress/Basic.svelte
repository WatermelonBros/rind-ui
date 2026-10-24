<script lang="ts">
import { Progress } from "@rind-ui/svelte"
</script>

<Progress.Root value={40}>
  <Progress.Label>Uploading</Progress.Label>
  <Progress.ValueText />
  <Progress.Track>
    <Progress.Indicator />
  </Progress.Track>
</Progress.Root>
