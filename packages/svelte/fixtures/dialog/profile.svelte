<script lang="ts">
import { Dialog, type DialogRootProps } from "../../src/index"

const { root = {}, portal = true }: { root?: Record<string, unknown>; portal?: boolean } = $props()
const alert = $derived(root["role"] === "alertdialog")
const title = $derived(alert ? "Delete project?" : "Edit profile")
</script>

<!-- As a theme lays them out: a full-screen backdrop, the content centred. No whitespace
     between parts: React's markup has none. -->
{#snippet parts()}
  <Dialog.Backdrop style="position: fixed; inset: 0px" /><Dialog.Positioner
    style="position: fixed; inset: 0px; display: grid; place-items: center"
    ><Dialog.Content
      >{#if alert}<Dialog.Title>{title}</Dialog.Title><Dialog.Description
          >This cannot be undone.</Dialog.Description
        ><Dialog.Cancel>Cancel</Dialog.Cancel><Dialog.Action>Delete</Dialog.Action
        >{:else}<Dialog.Title>{title}</Dialog.Title><Dialog.Description
          >Change your display name.</Dialog.Description
        ><label>Name <input /></label><Dialog.CloseTrigger>Close</Dialog.CloseTrigger><Dialog.Cancel
          >Cancel</Dialog.Cancel
        ><Dialog.Action>Save</Dialog.Action>{/if}</Dialog.Content
    ></Dialog.Positioner>
{/snippet}

<div id="app">
  <Dialog.Root {...(root as DialogRootProps)}
    ><Dialog.Trigger>{title}</Dialog.Trigger>{#if portal}<Dialog.Portal>{@render parts()}</Dialog.Portal
      >{:else}{@render parts()}{/if}</Dialog.Root
  >
</div>
