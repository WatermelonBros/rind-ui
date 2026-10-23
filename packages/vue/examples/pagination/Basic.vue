<script setup lang="ts">
import { Pagination } from "@rind-ui/vue"
</script>

<template>
  <Pagination.Root :total-pages="10" v-slot="state">
    <Pagination.List>
      <Pagination.Item type="trigger">
        <Pagination.Previous />
      </Pagination.Item>
      <template v-for="e in state.pages" :key="e.key">
        <Pagination.Item v-if="e.type === 'page'">
          <Pagination.Page :value="e.value" />
        </Pagination.Item>
        <Pagination.Item v-else type="ellipsis">
          <Pagination.Ellipsis :position="e.position" />
        </Pagination.Item>
      </template>
      <Pagination.Item type="trigger">
        <Pagination.Next />
      </Pagination.Item>
    </Pagination.List>
  </Pagination.Root>
</template>
