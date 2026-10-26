<script lang="ts">
import { MessageActions, RindProvider } from "../../src/index"

const {
  text,
  count = 0,
  onRegenerate,
  provider,
  full = true,
}: {
  text: string
  count?: number
  onRegenerate?: () => Promise<void>
  provider?: Record<string, unknown>
  full?: boolean
} = $props()
</script>

{#snippet row()}
  <MessageActions.Root {count} {onRegenerate}>
    <MessageActions.Copy value={() => text}>⧉</MessageActions.Copy>
    {#if full}<MessageActions.Regenerate>↻</MessageActions.Regenerate>{/if}
    <MessageActions.Edit>✎</MessageActions.Edit>
    {#if full}
      <MessageActions.Feedback>
        <MessageActions.FeedbackItem value="up">👍</MessageActions.FeedbackItem>
        <MessageActions.FeedbackItem value="down">👎</MessageActions.FeedbackItem>
      </MessageActions.Feedback>
    {/if}
    <MessageActions.Versions>
      <MessageActions.VersionPrevious>‹</MessageActions.VersionPrevious>
      <MessageActions.VersionStatus />
      {#if full}<MessageActions.VersionNext>›</MessageActions.VersionNext>{/if}
    </MessageActions.Versions>
  </MessageActions.Root>
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>
    <article data-testid="message"><p>{text}</p>{@render row()}</article>
  </RindProvider>
{:else}
  {@render row()}
{/if}
