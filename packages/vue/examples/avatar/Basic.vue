<script setup lang="ts">
import { Avatar } from "@rind-ui/vue"

// An inline SVG data URL: the example needs no network.
const face = (bg: string, fg: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="${bg}"/><circle cx="40" cy="32" r="14" fill="${fg}"/><path d="M14 80c2-16 13-24 26-24s24 8 26 24z" fill="${fg}"/></svg>`,
  )}`
const ADA = face("#c4b5fd", "#4c1d95")
const ALAN = face("#99f6e4", "#134e4a")
</script>

<template>
  <div class="row">
    <Avatar.Root aria-label="Ada Lovelace">
      <Avatar.Image :src="ADA" />
      <Avatar.Fallback>AL</Avatar.Fallback>
    </Avatar.Root>
    <Avatar.Root aria-label="Alan Turing" data-size="lg">
      <Avatar.Image :src="ALAN" />
      <Avatar.Fallback>AT</Avatar.Fallback>
    </Avatar.Root>
  </div>
</template>
