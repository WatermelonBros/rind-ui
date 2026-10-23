<script lang="ts">
import { Switch } from "@rind-ui/svelte"
</script>

<div class="stack">
  <Switch.Root defaultChecked>
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.Label>Wi-Fi</Switch.Label>
  </Switch.Root>
  <Switch.Root>
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.Label>Bluetooth</Switch.Label>
  </Switch.Root>
</div>
