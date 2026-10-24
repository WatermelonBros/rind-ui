<script setup lang="ts">
import { Fieldset, TextField } from "@rind-ui/vue"
</script>

<template>
  <Fieldset.Root>
    <Fieldset.Legend>Shipping address</Fieldset.Legend>
    <Fieldset.Description>All fields are required.</Fieldset.Description>
    <div class="stack">
      <TextField.Root name="street" required>
        <TextField.Label>Street</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <TextField.Root name="city" required>
        <TextField.Label>City</TextField.Label>
        <TextField.Input />
      </TextField.Root>
    </div>
  </Fieldset.Root>
</template>
