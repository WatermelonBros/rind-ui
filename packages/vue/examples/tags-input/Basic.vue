<script setup lang="ts">
import { TagsInput } from "@rind-ui/vue"
</script>

<template>
  <TagsInput.Root :default-value="['rome', 'paris']">
    <TagsInput.Label>Tags</TagsInput.Label>
    <TagsInput.Control data-variant="outline">
      <TagsInput.Chips />
      <TagsInput.Input placeholder="Add a tag" />
      <TagsInput.ClearTrigger aria-label="Clear all" />
    </TagsInput.Control>
  </TagsInput.Root>
</template>
