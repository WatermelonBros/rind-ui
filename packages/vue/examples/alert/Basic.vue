<script setup lang="ts">
import { Alert } from "@rind-ui/vue"
</script>

<template>
  <Alert.Root announce="off">
    <Alert.Icon>ℹ</Alert.Icon>
    <Alert.Title>Maintenance tonight</Alert.Title>
    <Alert.Description>Saving is paused from 22:00 to 22:30.</Alert.Description>
  </Alert.Root>
</template>
