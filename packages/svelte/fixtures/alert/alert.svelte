<script lang="ts">
import type { AlertAnnounce } from "@rind-ui/core"
import { Alert } from "../../src/alert"

const {
  announce,
  open,
  controlled = false,
  defaultOpen,
}: {
  announce?: AlertAnnounce
  open?: boolean
  controlled?: boolean
  defaultOpen?: boolean
} = $props()
</script>

<div>
  {#if controlled}
    <Alert.Root {announce} bind:open={() => open, () => {}}>
      <Alert.Title>Couldn't save</Alert.Title>
      <Alert.Description>Disk full</Alert.Description>
      <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
    </Alert.Root>
  {:else}
    <Alert.Root {announce} {defaultOpen}>
      <Alert.Title>Couldn't save</Alert.Title>
      <Alert.Description>Disk full</Alert.Description>
      <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
    </Alert.Root>
  {/if}
  <button type="button">Retry</button>
</div>
