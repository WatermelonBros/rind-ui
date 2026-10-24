<script lang="ts">
import type { Clock, Scheduler } from "@rind-ui/core"
import { Reasoning, type ReasoningRootProps, RindProvider } from "../../src/index"

// The model's reasoning (a virtual clock) or a bare one for parity.
const { scheduler, clock, ...root }: ReasoningRootProps & { scheduler?: Scheduler; clock?: Clock } =
  $props()
</script>

{#snippet reasoning()}<Reasoning.Root {...root}
    ><Reasoning.Trigger /><Reasoning.Content>The moon pulls the water.</Reasoning.Content
    ></Reasoning.Root
  >{/snippet}

{#if scheduler && clock}<RindProvider environment={{ scheduler, clock }}
    >{@render reasoning()}</RindProvider
  >{:else}{@render reasoning()}{/if}
