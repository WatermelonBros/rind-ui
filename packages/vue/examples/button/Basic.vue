<script setup lang="ts">
import { Button } from "@rind-ui/vue"
import { ref } from "vue"

const pending = ref(false)
const count = ref(0)

function save() {
  pending.value = true
  setTimeout(() => {
    pending.value = false
  }, 1500)
}
</script>

<template>
  <div class="row">
    <Button @press="count++">Pressed {{ count }}×</Button>
    <Button :pending="pending" @press="save">{{ pending ? "Saving…" : "Save" }}</Button>
    <Button disabled>Disabled</Button>
  </div>
</template>
