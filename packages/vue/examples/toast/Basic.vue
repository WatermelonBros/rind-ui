<script setup lang="ts">
import { createToaster } from "@rind-ui/core"
import { Toast, Toaster } from "@rind-ui/vue"

// One store for the app: show toasts from anywhere with `toaster.show(...)`.
const toaster = createToaster()
// Not portalled here: the region stays inside the example. In an app, render one Toaster at
// the root with the default portal.
const messages = { regionLabel: (key: string) => `Basic notifications (${key})` }
</script>

<template>
  <button type="button" @click="toaster.show('Changes saved')">Save</button>
  <Toaster :toaster="toaster" :portal="false" :messages="messages">
    <template #default="t">
      <Toast.Root>
        <Toast.Title />
        <Toast.Description v-if="t.data.description" />
        <Toast.ActionTrigger v-if="t.data.action" />
        <Toast.CloseTrigger>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </Toast.CloseTrigger>
      </Toast.Root>
    </template>
  </Toaster>
</template>
