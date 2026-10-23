<script setup lang="ts">
import { Breadcrumbs } from "@rind-ui/vue"

const crumbs: readonly { label: string; href?: string }[] = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs/" },
  { label: "Breadcrumbs" },
]
</script>

<template>
  <Breadcrumbs.Root>
    <Breadcrumbs.List>
      <Breadcrumbs.Item v-for="c in crumbs" :key="c.label" :value="c.label">
        <Breadcrumbs.Link :href="c.href">{{ c.label }}</Breadcrumbs.Link>
        <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
      </Breadcrumbs.Item>
    </Breadcrumbs.List>
  </Breadcrumbs.Root>
</template>
