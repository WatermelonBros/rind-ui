<script lang="ts">
import type { CitationSource } from "@rind-ui/core"
import { Citation, RindProvider } from "../../src/index"

const {
  source,
  index = 1,
  card = true,
  onPinnedChange,
}: {
  source?: CitationSource
  index?: number
  card?: boolean
  onPinnedChange?: (pinned: boolean) => void
} = $props()
</script>

<RindProvider>
  <p>
    <Citation.Root {index} {source} {onPinnedChange}>
      <Citation.Trigger>[{index}]</Citation.Trigger>
      {#if card}
        <!-- Portalled: the card (block content) must not sit inside the paragraph. -->
        <Citation.Portal>
          <Citation.Positioner>
            <Citation.Content>
              <Citation.Source><Citation.SourceTitle /><Citation.SourceSnippet /></Citation.Source>
            </Citation.Content>
          </Citation.Positioner>
        </Citation.Portal>
      {/if}
    </Citation.Root>
  </p>
</RindProvider>
