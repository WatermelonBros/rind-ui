<script lang="ts">
import { Editable, RindProvider } from "../../src/index"

const {
  root = {},
  textarea = false,
  full = true,
}: { root?: Record<string, unknown>; textarea?: boolean; full?: boolean } = $props()
</script>

{#snippet field()}
  <Editable.Root {...(full ? { name: "title" } : {})} defaultValue="Hello" {...root}>
    <Editable.Label>Title</Editable.Label>
    <Editable.Area>
      <Editable.Preview />
      {#if !full}
        <!-- Parity: no Input (React writes a controlled input's value as an attribute). -->
      {:else if textarea}
        <Editable.Input>{#snippet child({ props })}<textarea {...props}></textarea>{/snippet}</Editable.Input>
      {:else}
        <Editable.Input />
      {/if}
    </Editable.Area>
    {#if full}
      <Editable.Control>
        <Editable.EditTrigger>Edit</Editable.EditTrigger>
        <Editable.SubmitTrigger>Save</Editable.SubmitTrigger>
        <Editable.CancelTrigger>Cancel</Editable.CancelTrigger>
      </Editable.Control>
    {/if}
  </Editable.Root>
{/snippet}

<RindProvider>
  {#if full}
    <form onsubmit={(e) => e.preventDefault()}>{@render field()}<button type="button">Elsewhere</button></form>
  {:else}
    {@render field()}
  {/if}
</RindProvider>
