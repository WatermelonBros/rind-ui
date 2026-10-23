<script setup lang="ts">
import { Switch } from "@rind-ui/vue"
</script>

<template>
  <div class="stack">
    <Switch.Root default-checked>
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
</template>
