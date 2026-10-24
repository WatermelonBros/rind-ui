<script setup lang="ts">
import { Tabs } from "@rind-ui/vue"
</script>

<template>
  <Tabs.Root default-value="account">
    <Tabs.List aria-label="Settings">
      <Tabs.Tab value="account">Account</Tabs.Tab>
      <Tabs.Tab value="billing">Billing</Tabs.Tab>
      <Tabs.Tab value="team">Team</Tabs.Tab>
      <Tabs.Indicator />
    </Tabs.List>
    <Tabs.Panel value="account">
      <p class="pad">Name, email and avatar.</p>
    </Tabs.Panel>
    <Tabs.Panel value="billing">
      <p class="pad">Plan, invoices and payment method.</p>
    </Tabs.Panel>
    <Tabs.Panel value="team">
      <p class="pad">Members, roles and invitations.</p>
    </Tabs.Panel>
  </Tabs.Root>
</template>
