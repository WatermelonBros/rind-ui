<script setup lang="ts">
import { Accordion } from "@rind-ui/vue"
</script>

<template>
  <Accordion.Root :default-value="['shipping']">
    <Accordion.Item value="shipping">
      <Accordion.Header>
        <Accordion.Trigger>Shipping <Accordion.Indicator>+</Accordion.Indicator></Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content>
        <div class="pad">Ships in two days, tracked to your door.</div>
      </Accordion.Content>
    </Accordion.Item>
    <Accordion.Item value="returns">
      <Accordion.Header>
        <Accordion.Trigger>Returns <Accordion.Indicator>+</Accordion.Indicator></Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content>
        <div class="pad">Thirty days, no questions, free pickup.</div>
      </Accordion.Content>
    </Accordion.Item>
    <Accordion.Item value="payment">
      <Accordion.Header>
        <Accordion.Trigger>Payment <Accordion.Indicator>+</Accordion.Indicator></Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content>
        <div class="pad">Cards, transfers and the usual wallets.</div>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
</template>
