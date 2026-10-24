# @rind-ui/solid

SolidJS components for rind-ui: behaviour, accessibility and state — you bring the styles. The
same machines, ARIA and test drivers as `@rind-ui/react`, with Solid's idioms (reactive props,
`on<Value>Change` callbacks, a `render` function for element substitution).

```sh
pnpm add @rind-ui/solid
```

```tsx
import { Toggle } from "@rind-ui/solid" // or "@rind-ui/solid/toggle"
import { createSignal } from "solid-js"

function Bold() {
  const [bold, setBold] = createSignal(false)
  return (
    <Toggle.Root pressed={bold()} onPressedChange={setBold}>
      Bold
    </Toggle.Root>
  )
}
```

Each entry ships its JSX under the `solid` export condition (compiled by your
`vite-plugin-solid` for the DOM or the server) and DOM-compiled JavaScript as `default`.
Components are being ported one at a time; `package.json` `exports` lists the ones this version
ships. Part of [rind-ui](https://github.com/WatermelonBros/rind-ui).

MIT © rind-ui contributors
