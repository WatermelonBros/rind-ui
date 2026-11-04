<script lang="ts">
import type { Toaster as ToasterStore } from "@rind-ui/core"
import { RindProvider, Toast, Toaster } from "../../src/index"

const { store }: { store: ToasterStore } = $props()
</script>

<RindProvider messages={{ toast: { regionLabel: (k) => `Avvisi (${k})`, close: "Chiudi" } }}>
  <Toaster toaster={store} messages={{ close: "Ferme" }}>
    {#snippet children()}
      <Toast.Root
        ><Toast.Title /><Toast.CloseTrigger><svg aria-hidden="true" width="12" height="12" /></Toast.CloseTrigger
        ></Toast.Root>
    {/snippet}
  </Toaster>
</RindProvider>
