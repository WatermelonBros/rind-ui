<script lang="ts">
import type { Toaster as ToasterStore } from "@rind-ui/core"
import { Toast, Toaster } from "../../src/index"

const {
  store,
  portal = true,
  minimal = false,
}: { store: ToasterStore; portal?: boolean; minimal?: boolean } = $props()
</script>

<div>
  <input aria-label="Name" />
  <Toaster toaster={store} {portal}>
    {#snippet children(t)}
      {#if minimal}
        <Toast.Root><Toast.Title /><Toast.CloseTrigger>Dismiss</Toast.CloseTrigger></Toast.Root>
      {:else}
        <Toast.Root
          ><Toast.Title />{#if t.data.description}<Toast.Description />{/if}{#if t.data.action}<Toast.ActionTrigger
            />{/if}<Toast.CloseTrigger><svg aria-hidden="true" width="12" height="12" /></Toast.CloseTrigger
          ></Toast.Root>
      {/if}
    {/snippet}
  </Toaster>
</div>
