# @rind-ui/vue

Vue 3 components for rind-ui: behaviour, accessibility and state — you bring the styles. The
same machines, ARIA and test drivers as `@rind-ui/react`, with Vue's idioms (`v-model`,
`asChild`, scoped slots).

```sh
pnpm add @rind-ui/vue
```

```vue
<script setup lang="ts">
import { Toggle } from "@rind-ui/vue" // or "@rind-ui/vue/toggle"
import { ref } from "vue"

const bold = ref(false)
</script>

<template>
  <Toggle.Root v-model:pressed="bold">Bold</Toggle.Root>
</template>
```

Components are being ported one at a time; `package.json` `exports` lists the ones this
version ships. Part of [rind-ui](https://github.com/WatermelonBros/rind-ui).

MIT © rind-ui contributors
