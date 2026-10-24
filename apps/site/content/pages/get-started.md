# Get started

rind is a set of headless components. You get behaviour, keyboard support, accessibility and state. You do not get styles, so the look is entirely yours.

<!-- pre-1.0 -->
> rind is at {{version}}: the packages are on npm, and the API can still change before 1.0.
<!-- /pre-1.0 -->
<!-- 1.0+ -->
> rind is at {{version}}, a stable release: see [Versioning](#versioning) for what can change and how.
<!-- /1.0+ -->

## Packages

You install the framework package. Everything else is optional.

| Package | What it is | Do you need it? |
|---|---|---|
| `@rind-ui/react` | The components for React: `Accordion.Root`, `Button`, `TextField.Input`… | **Yes**, if you use React |
| `@rind-ui/core` | State machines, DOM helpers and contracts. No framework. Every framework package is built on it | It comes with the framework package |
| `@rind-ui/theme` | An optional ready-made CSS theme on the same `data-*` attributes | Only if you want a starting look |
| `@rind-ui/testing` | Test drivers for every component, for Testing Library and Playwright | In tests (dev dependency) |

## Install

{{install}}

`@rind-ui/core` comes with it as a dependency. React 19 or newer is required.

Your bundle carries only the components you import, from the package root or from a subpath
(`@rind-ui/react/dialog`). Within a component, Vite, Rollup, Rolldown and webpack also drop the
parts you never render: an app that uses `Dialog.Root`, `Dialog.Trigger` and `Dialog.Content`
does not ship `Dialog.Backdrop`. esbuild keeps every part of a component you import.

## Your first component

```tsx
import { Accordion } from "@rind-ui/react"

export function Faq() {
  return (
    <Accordion.Root defaultValue={["shipping"]}>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>Ships in two days.</Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  )
}
```

This already works. It renders the right roles, handles Enter, Space and Tab, links the trigger to its panel, and keeps closed panels findable by the browser's search. It just looks like plain HTML.

## Styling

Every part renders `data-scope` and `data-part`, and its state as `data-state`, `data-disabled`, `data-hover`, `data-focus-visible` and the matching `aria-*`. You style those attributes with any CSS you like: plain CSS, CSS modules, Tailwind or CSS-in-JS.

```css
[data-scope="accordion"][data-part="trigger"] {
  padding: 12px 16px;
  font-weight: 600;
}
[data-scope="accordion"][data-part="trigger"][data-state="open"] {
  background: #d4ff3a;
}
[data-scope="accordion"][data-part="content"] {
  overflow: hidden;
  height: var(--rind-accordion-content-height);
  transition: height 0.4s ease;
}
```

You can also pass `className` to any part, as you would to the element it renders.

**About the looks on this site.** The *crisp* and *juicy* skins you see in the examples are this site's own styles, written the same way. No package ships them. Every example has a **bare** view that shows exactly what you install, and its "Get code" panel shows our CSS if you want to start from it.

**Want a starting point?** `@rind-ui/theme` is an optional, white-label theme built on the same attributes. One brand colour re-skins every component.

```ts
import "@rind-ui/theme"
```

See [`@rind-ui/theme` on npm](https://www.npmjs.com/package/@rind-ui/theme).

## Testing

Every component ships a **driver**: the actions and queries a user can perform, such as `expand`, `choose` or `isInvalid`. The same test runs in Testing Library and in Playwright, so you never write "open the select, pick an option" helpers again.

```sh
pnpm add -D @rind-ui/testing
```

```ts
// vitest.config.ts — polyfills jsdom and cleans up after each test, with or without globals
export default { test: { environment: "jsdom", setupFiles: ["@rind-ui/testing/setup"] } }
```

```ts
import { getAccordion } from "@rind-ui/testing"

const faq = getAccordion(container, { item: "Shipping" })
await faq.expand("Shipping")
expect(await faq.expanded()).toEqual(["Shipping"])
```

In Playwright, import from `@rind-ui/testing/playwright` and pass the `page`. Each component page documents its driver.

<!-- 1.0+ -->
## Versioning

rind follows [semantic versioning](https://semver.org). The public API is everything you can see
from outside: component and part names, props, the `data-*` and `aria-*` attributes parts
render, CSS custom properties, messages, and each driver's actions and queries.

- **Patch** fixes behaviour to match its spec; **minor** adds components, parts, props or
  attributes. Neither breaks code or stylesheets written against the documented API.
- **Major** is the only release that removes or renames something. Before that, the old name
  keeps working with a development-only warning for at least one minor release.

<!-- /1.0+ -->
## Frameworks

rind's behaviour lives in `@rind-ui/core`, which has no framework in it. A framework package only wires parts, refs and props, so each one gets the same behaviour, accessibility and drivers.

{{frameworks}}

## Using rind with an AI assistant

The whole API is generated from source into [`llms.txt`](/llms.txt), so an assistant can learn the library and write against it without guessing. The drivers let it check its own work.

Every docs page also has a markdown twin at `/docs/<component>.md`, and [`llms-full.txt`](/llms-full.txt) holds the whole documentation in one file. For coding agents that load skills (the Agent Skills format), the repository ships one: [`skills/rind-ui`](https://github.com/WatermelonBros/rind-ui/tree/main/skills/rind-ui). It tells the agent where the API lives, how to compose parts and style attributes, and how to verify the result with the drivers.

Agents that speak MCP (Claude Code, Cursor, VS Code and others) can also add rind-ui's MCP server, which lists the components and reads their docs on demand:

```sh
claude mcp add rind-ui -- npx -y @rind-ui/mcp
```
