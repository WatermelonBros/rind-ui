<script setup lang="ts">
import { Rating } from "@rind-ui/vue"
</script>

<template>
  <Rating.Root :default-value="3">
    <Rating.Label>Rate this recipe</Rating.Label>
    <Rating.Control>
      <Rating.Item v-for="i in 5" :key="i" :index="i" />
    </Rating.Control>
  </Rating.Root>
</template>
