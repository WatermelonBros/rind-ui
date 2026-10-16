# Get started

rind is a set of headless components. You get behaviour, keyboard support, accessibility and state. You do not get styles, so the look is entirely yours.

> rind is at 0.1: the packages are on npm, and the API can still change before 1.0.

## Packages

You install the framework package. Everything else is optional.

| Package | What it is | Do you need it? |
|---|---|---|
| `@rind-ui/react` | The components for React: `Accordion.Root`, `Button`, `TextField.Input`… | **Yes**, if you use React |
| `@rind-ui/core` | State machines, DOM helpers and contracts. No framework. Every framework package is built on it | It comes with the framework package |
| `@rind-ui/theme` | An optional ready-made CSS theme on the same `data-*` attributes | Only if you want a starting look |
| `@rind-ui/testing` | Test drivers for every component, for Testing Library and Playwright | In tests (dev dependency) |

## Install

```sh
pnpm add @rind-ui/react
```

`@rind-ui/core` comes with it as a dependency. React 19 or newer is required.

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

See [White-label theming](https://github.com/WatermelonBros/rind-ui/blob/main/docs/theme/white-label.md).

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

## Frameworks

rind's behaviour lives in `@rind-ui/core`, which has no framework in it. A framework package only wires parts, refs and props, so each one gets the same behaviour, accessibility and drivers.

| Framework | Package | Status |
|---|---|---|
| React | `@rind-ui/react` | Available |
| Vue | `@rind-ui/vue` | Planned |
| Svelte | `@rind-ui/svelte` | Planned |
| Solid | `@rind-ui/solid` | Planned |
| Angular | `@rind-ui/angular` | Planned |

## Using rind with an AI assistant

The whole API is generated from source into [`llms.txt`](https://github.com/WatermelonBros/rind-ui/blob/main/llms.txt), so an assistant can learn the library and write against it without guessing. The drivers let it check its own work.
