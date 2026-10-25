# @rind-ui/solid

SolidJS components for rind-ui: behaviour, accessibility and state — you bring the styles. The
same machines, ARIA and test drivers as `@rind-ui/react`, with Solid's idioms (reactive props,
`on<Value>Change` callbacks, a `render` function for element substitution).

```sh
pnpm add @rind-ui/solid
```

Needs `solid-js` 1.9 or later (not 2).

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

Import a component from the root or from its own entry (`@rind-ui/solid/dialog`): your bundle
carries only the components you import. Each entry ships its JSX under the `solid` export
condition (compiled by your `vite-plugin-solid` for the DOM or the server, SolidStart included)
and DOM-compiled JavaScript as `default`. Server rendering and hydration render the same markup
as React's.

Wrap the app in `<RindProvider>` to set the locale, the direction and the environment (a test's
clock); without it the defaults apply. `@rind-ui/testing` drives the components in your tests
through the same drivers as every framework.

Part of [rind-ui](https://github.com/WatermelonBros/rind-ui): see the main README and
`docs/components/` for the components and their APIs.

MIT © rind-ui contributors
