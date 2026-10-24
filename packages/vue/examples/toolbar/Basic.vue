<script setup lang="ts">
import { RadioGroup, ToggleGroup, Toolbar } from "@rind-ui/vue"
</script>

<template>
  <Toolbar.Root aria-label="Formatting">
    <ToggleGroup.Root aria-label="Text style" selection-mode="multiple" :default-value="['bold']">
      <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
      <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
    </ToggleGroup.Root>
    <Toolbar.Separator />
    <RadioGroup.Root aria-label="Alignment" orientation="horizontal" default-value="left">
      <RadioGroup.Item v-for="value in ['left', 'center', 'right']" :key="value" :value="value">
        <RadioGroup.ItemControl>
          <RadioGroup.ItemIndicator />
        </RadioGroup.ItemControl>
        <RadioGroup.ItemLabel>{{ value }}</RadioGroup.ItemLabel>
      </RadioGroup.Item>
    </RadioGroup.Root>
    <Toolbar.Separator />
    <Toolbar.Button>Share</Toolbar.Button>
  </Toolbar.Root>
</template>
