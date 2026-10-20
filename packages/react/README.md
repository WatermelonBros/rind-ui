# @rind-ui/react

React components for rind-ui: behaviour, accessibility and state — you bring the styles.

```sh
pnpm add @rind-ui/react
```

```ts
import { Accordion } from "@rind-ui/react"
// or one component's own entry: same export, same bundle size
import { Accordion } from "@rind-ui/react/accordion"
```

Your bundle carries only the components you import. The components are client components
(`"use client"`), so a Next app can render them from a Server Component.

Part of [rind-ui](https://github.com/WatermelonBros/rind-ui): see the main README and
`docs/components/` for the components and their APIs.

MIT © rind-ui contributors
