<script setup lang="ts">
import { Kbd } from "@rind-ui/vue"

const SHORTCUTS = [
  { action: "Command palette", keys: "mod+k" },
  { action: "Save", keys: "mod+s" },
  { action: "Find in files", keys: "mod+shift+f" },
  { action: "Go to inbox", keys: "g i" },
  { action: "Close", keys: "escape" },
]
</script>

<template>
  <dl
    style="
      display: grid;
      grid-template-columns: max-content max-content;
      gap: 10px 24px;
      align-items: center;
      margin: 0;
    "
  >
    <div v-for="s in SHORTCUTS" :key="s.action" style="display: contents">
      <dt>{{ s.action }}</dt>
      <dd style="margin: 0">
        <Kbd.Root :keys="s.keys" />
      </dd>
    </div>
  </dl>
</template>
