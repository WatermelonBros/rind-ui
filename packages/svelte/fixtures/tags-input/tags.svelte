<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { RindProvider, TagsInput, type TagsInputRootProps } from "../../src/index"

// The Tags Input example (model and parity). No whitespace between parts: React's markup has none.
const {
  root = {},
  suggestions = false,
  provider = true,
}: { root?: Record<string, unknown>; suggestions?: boolean; provider?: boolean } = $props()
const rootProps = $derived(root as TagsInputRootProps)
</script>

{#snippet body()}<TagsInput.Root {...rootProps}
    ><TagsInput.Label>Tags</TagsInput.Label><TagsInput.Control
      ><TagsInput.Chips /><TagsInput.Input /><TagsInput.ClearTrigger /></TagsInput.Control
    >{#if suggestions}<TagsInput.Positioner
        ><TagsInput.Popup><TagsInput.List><TagsInput.Items /></TagsInput.List></TagsInput.Popup
        ></TagsInput.Positioner
      >{/if}</TagsInput.Root
  >{/snippet}

{#if provider}<RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    >{@render body()}<button type="button">After</button></RindProvider
  >{:else}<div>{@render body()}</div>{/if}
