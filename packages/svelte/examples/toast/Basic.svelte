<script lang="ts">
import { createToaster } from "@rind-ui/core"
import { Toast, Toaster } from "@rind-ui/svelte"

// One store for the app: show toasts from anywhere with `toaster.show(...)`.
const toaster = createToaster()
// Not portalled here: the region stays inside the example. In an app, render one Toaster at
// the root with the default portal.
const messages = { regionLabel: (key: string) => `Basic notifications (${key})` }
</script>

<button type="button" onclick={() => toaster.show("Changes saved")}>Save</button>
<Toaster {toaster} portal={false} {messages}>
  {#snippet children(t)}
    <Toast.Root>
      <Toast.Title />
      {#if t.data.description}<Toast.Description />{/if}
      {#if t.data.action}<Toast.ActionTrigger />{/if}
      <Toast.CloseTrigger>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </Toast.CloseTrigger>
    </Toast.Root>
  {/snippet}
</Toaster>
