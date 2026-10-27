<script lang="ts">
import { RindProvider, SignaturePad } from "../../src/index"

const {
  root = {},
  provider,
  form = false,
}: {
  root?: Record<string, unknown>
  provider?: Record<string, unknown>
  form?: boolean
} = $props()
</script>

{#snippet pad()}
  <SignaturePad.Root name="signature" {...root}>
    <SignaturePad.Label>Signature</SignaturePad.Label>
    <SignaturePad.Control style="width: 300px; height: 120px; display: block"><SignaturePad.Segment /><SignaturePad.Guide /></SignaturePad.Control>
    <SignaturePad.Status />
    <SignaturePad.UndoTrigger>Undo</SignaturePad.UndoTrigger>
    <SignaturePad.ClearTrigger>Clear</SignaturePad.ClearTrigger>
  </SignaturePad.Root>
{/snippet}

{#snippet body()}
  {#if form}
    <form onsubmit={(e) => e.preventDefault()}>{@render pad()}<button type="submit">Send</button></form>
  {:else}
    {@render pad()}
  {/if}
{/snippet}

{#if provider}
  <RindProvider {...(provider as { announcer?: never })}>{@render body()}</RindProvider>
{:else}
  {@render body()}
{/if}
