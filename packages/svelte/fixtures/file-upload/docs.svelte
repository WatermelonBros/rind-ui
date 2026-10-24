<script lang="ts">
import { FileUpload, RindProvider } from "../../src/index"

const {
  root = {},
  items = false,
  announcer,
}: { root?: Record<string, unknown>; items?: boolean; announcer?: unknown } = $props()
</script>

{#snippet upload()}
  <FileUpload.Root name="docs" {...root}>
    {#snippet children(s)}
      <FileUpload.Label>Documents</FileUpload.Label>
      <FileUpload.Dropzone>Drop files here<FileUpload.Trigger>Choose file</FileUpload.Trigger></FileUpload.Dropzone>
      {#if items}
        <FileUpload.ItemGroup>
          {#each s.files as file (file.name)}<FileUpload.Item {file}><FileUpload.ItemName /><FileUpload.ItemSize /><FileUpload.ItemRemove
                >Remove</FileUpload.ItemRemove
              ></FileUpload.Item>{/each}
        </FileUpload.ItemGroup>
        <FileUpload.ClearTrigger>Clear</FileUpload.ClearTrigger>
      {/if}
    {/snippet}
  </FileUpload.Root>
{/snippet}

{#if announcer}
  <RindProvider announcer={announcer as never}><form>{@render upload()}<button type="reset">Reset</button></form></RindProvider>
{:else}
  {@render upload()}
{/if}
