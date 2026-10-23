<script lang="ts">
import { Progress, type ProgressRootProps } from "../../src/index"

const { ring = false, ...props }: ProgressRootProps & { ring?: boolean } = $props()
</script>

{#if ring}
  <Progress.Root {...props}>
    <Progress.Circle><Progress.CircleTrack /><Progress.CircleIndicator /></Progress.Circle>
  </Progress.Root>
{:else}
  <Progress.Root {...props}>
    <Progress.Label>Uploading</Progress.Label>
    <Progress.ValueText />
    <Progress.Track><Progress.Indicator /></Progress.Track>
  </Progress.Root>
{/if}
