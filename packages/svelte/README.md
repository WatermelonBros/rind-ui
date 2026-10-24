# @rind-ui/svelte

Svelte 5 components for rind-ui: behaviour, accessibility and state — you bring the styles.
The same machines, ARIA and test drivers as `@rind-ui/react`, with Svelte's idioms (`bind:`,
`child` and `children` snippets, attachments).

```sh
pnpm add @rind-ui/svelte
```

```svelte
<script lang="ts">
  import { Toggle } from "@rind-ui/svelte" // or "@rind-ui/svelte/toggle"

  let bold = $state(false)
</script>

<Toggle.Root bind:pressed={bold}>Bold</Toggle.Root>
```

Components are being ported one at a time; `package.json` `exports` lists the ones this
version ships. Part of [rind-ui](https://github.com/WatermelonBros/rind-ui).

MIT © rind-ui contributors
