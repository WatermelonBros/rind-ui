<script setup lang="ts">
import { Collapsible } from "@rind-ui/vue"
</script>

<template>
  <Collapsible.Root>
    <Collapsible.Trigger>
      <Collapsible.Indicator>▸</Collapsible.Indicator>
      What does headless mean?
    </Collapsible.Trigger>
    <Collapsible.Content>
      <div class="pad">Behaviour, accessibility and state, with no styles. You bring the look.</div>
    </Collapsible.Content>
  </Collapsible.Root>
</template>
