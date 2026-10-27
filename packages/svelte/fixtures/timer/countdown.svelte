<script lang="ts">
import { RindProvider, Timer } from "../../src/index"

const {
  root = {},
  provider,
}: {
  root?: Record<string, unknown>
  provider?: Record<string, unknown>
} = $props()
</script>

{#snippet timer()}
  <Timer.Root countdown startMs={65_000} {...root}>
    <!-- One line: whitespace between items would be text in the Area. -->
    <Timer.Area><Timer.Item type="minutes"><Timer.ItemValue /><Timer.ItemLabel>min</Timer.ItemLabel></Timer.Item><Timer.Separator>:</Timer.Separator><Timer.Item type="seconds"><Timer.ItemValue /></Timer.Item></Timer.Area>
    <Timer.Control>
      <Timer.ActionTrigger action="toggle">{#snippet children({ label })}{label}{/snippet}</Timer.ActionTrigger>
      <Timer.ActionTrigger action="pause" />
      <Timer.ActionTrigger action="reset">Reset</Timer.ActionTrigger>
    </Timer.Control>
  </Timer.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render timer()}</RindProvider>
{:else}
  {@render timer()}
{/if}
