<script lang="ts">
import { CodeBlock, RindProvider } from "../../src/index"

const {
  root,
  provider,
}: { root: Record<string, unknown> & { code: string }; provider?: Record<string, unknown> } =
  $props()
</script>

{#snippet block()}
  <CodeBlock.Root {...root}>
    <CodeBlock.Header>
      <CodeBlock.Title>lines.txt</CodeBlock.Title>
      <CodeBlock.CopyTrigger />
      <CodeBlock.WrapTrigger />
      <CodeBlock.CollapseTrigger />
    </CodeBlock.Header>
    <CodeBlock.Content />
  </CodeBlock.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render block()}</RindProvider>
{:else}
  {@render block()}
{/if}
