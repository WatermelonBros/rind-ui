<script lang="ts">
import type { Scheduler } from "@rind-ui/core"
import { RindProvider, StreamingMessage, type StreamingMessageRootProps } from "../../src/index"

// The model's reply (a virtual clock, motion on) or a bare one for parity.
const { scheduler, ...root }: StreamingMessageRootProps & { scheduler?: Scheduler } = $props()
</script>

{#snippet reply()}<StreamingMessage.Root {...root}
    ><StreamingMessage.Content /><StreamingMessage.Caret /></StreamingMessage.Root
  >{/snippet}

{#if scheduler}<RindProvider environment={{ scheduler, reducedMotion: false }}
    >{@render reply()}</RindProvider
  >{:else}{@render reply()}{/if}
