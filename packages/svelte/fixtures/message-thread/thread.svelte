<script lang="ts">
import { MessageThread, type MessageThreadRootProps, RindProvider } from "../../src/index"

// The model's thread (12 fixed-height messages, reduced motion) or the parity thread (3).
const { root = {}, model = false }: { root?: Record<string, unknown>; model?: boolean } = $props()
const rootProps = $derived(root as Omit<MessageThreadRootProps, "count">)
const count = $derived(model ? 12 : 3)
const from = (i: number) =>
  model ? (i % 2 ? "assistant" : "user") : i === 1 ? "assistant" : "user"
</script>

{#snippet thread()}<MessageThread.Root {count} {...rootProps}
    ><MessageThread.Viewport style={model ? "height: 200px" : undefined}
      >{#each { length: count }, i (i)}<MessageThread.Message index={i} from={from(i)}
          >{#if model}<p style="margin: 0; height: 60px">message {i}</p>{:else}<p>message {i}</p
            >{/if}</MessageThread.Message
        >{/each}</MessageThread.Viewport
    ><MessageThread.JumpToLatest /></MessageThread.Root
  >{/snippet}

{#if model}<RindProvider environment={{ reducedMotion: true }}>{@render thread()}</RindProvider
  >{:else}{@render thread()}{/if}
