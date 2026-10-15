# Link

A navigational link that behaves like a native `<a href>` wherever it appears: client routing without double navigation, modifier clicks left to the browser, disabled and current states, and a driver to test it.

```tsx
import { Link } from "@rind-ui/react"

<p>
  Read the <Link href="/docs">documentation</Link>.
</p>
```

Link is stateless: it has no machine. Every link part in rind-ui (Breadcrumbs, Pagination,
Navigation Menu links) uses the same rules, from `linkProps` in `@rind-ui/core`.

## API

<!-- api:link -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Link` | `link` | `<a>` | The link itself. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `href` | `Href` | — | Where it goes. Typed by an augmented `RouterConfig`. |
| `target` | `string` | — | Passed to the anchor; not `_self` opens elsewhere. |
| `rel` | `string` | — | Passed to the anchor. |
| `download` | `boolean \| string` | — | Download instead of navigating. |
| `ping` | `string` | — | Passed to the anchor. |
| `referrerPolicy` | `ReferrerPolicy` | — | Passed to the anchor. |
| `hrefLang` | `string` | — | Passed to the anchor. |
| `routerOptions` | `RouterOptions` | — | Passed unchanged to the router's `navigate`. |
| `disabled` | `boolean` | `false` | No `href`, `aria-disabled`, out of the Tab order; nothing navigates. |
| `focusableWhenDisabled` | `boolean` | `false` | Keeps a disabled link in the Tab order. |
| `current` | `boolean \| "page" \| "step" \| "location" \| "date" \| "time"` | — | Sets `aria-current` and `data-current`; the link still navigates. |
| `onActivate` | `(details: LinkActivation) => void` | — | Once per activation, with `href`, `modality` and `disposition` (`"same-tab"` or `"elsewhere"`). |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element (`<div />` gets the `role="link"` fallback) or a component, such as a router's Link, which then navigates itself. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `link` | `data-scope` | "link" |
| `link` | `data-part` | "link" |
| `link` | `data-instance` | The instance id. |
| `link` | `data-current` | While `current` is set. |
| `link` | `data-disabled` | While disabled. |
| `link` | `data-external` | The resolved URL is on another origin. |
| `link` | `data-focus` | While focused. |
| `link` | `data-focus-visible` | While focused by keyboard or assistive technology. |
| `link` | `data-hover` | While a mouse or pen is over it. |
| `link` | `data-pressed` | While a press is in progress. |

### Keyboard

| Key | Action |
|---|---|
| Enter | Follows the link. |
| ⌘/Ctrl + Enter | Opens it in a new tab (the router is not called). |
| Shift + Enter | Opens it in a new window. |
| Space | Nothing: the page scrolls, as for a native link. |
| Tab / Shift + Tab | Next / previous tabbable element; a disabled link is skipped. |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

| Action | Modalities |
|---|---|
| `follow` | pointer, keyboard, virtual |
| `followInNewTab` | pointer, keyboard, virtual |
| `middleClick` | pointer, virtual |

Queries: `href`, `current`, `isDisabled`, `isExternal`, `isFocusVisible`. Traits: none.
<!-- /api -->

## Client routing

Without a router, the browser navigates. With one, a plain click or Enter calls
`router.navigate(href, routerOptions)` once and the page does not reload. Modifier clicks
(⌘/Ctrl, Shift, Alt), middle clicks, `target` other than `_self`, `download` and links to
another origin are always left to the browser.

`RouterProvider` takes two plain functions, never hooks:

```tsx
// React Router
import { useHref, useNavigate } from "react-router"
import { RouterProvider } from "@rind-ui/react"

function Routing({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const base = useHref("/") // the basename, read once here
  return (
    <RouterProvider navigate={(to, options) => navigate(to, options)} href={(to) => base.replace(/\/$/, "") + to}>
      {children}
    </RouterProvider>
  )
}
```

```tsx
// Next.js (app router), in a client component
"use client"
import { useRouter } from "next/navigation"

export function Routing({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  return <RouterProvider navigate={(href) => router.push(href)}>{children}</RouterProvider>
}
```

```tsx
// TanStack Router
<RouterProvider
  navigate={(to, options) => router.navigate({ to, ...options })}
  href={(to) => router.buildLocation({ to }).href}
>
```

`href` maps relative and root-relative values (a basename); URLs with a scheme (`https:`,
`mailto:`) and `//` URLs are never rewritten. Type `href` and `routerOptions` for your router:

```ts
declare module "@rind-ui/core" {
  interface RouterConfig {
    routerOptions: { replace?: boolean }
  }
}
```

### `render` or `RouterProvider`?

`render={<RouterLink to="/docs" />}` hands navigation to the router's own Link component:
rind-ui then never calls the provider's router for that link, so nothing navigates twice. Use
`RouterProvider` for parts that render links you do not write (Pagination pages, collapsed
breadcrumbs, menu items).

## Why Space does nothing

Native links activate with Enter only; Space scrolls the page. Link keeps that, so users get
what every other link on the web does.

## Disabled links

A disabled link has no `href`, carries `role="link"`, `aria-disabled="true"` and
`tabindex="-1"`: Tab skips it, but TalkBack can still reach it (quirk
`talkback-unfocusable-link`). Nothing activates it, and your `onClick` is not called. With
`focusableWhenDisabled` it stays in the Tab order. When users must be able to click it,
render a Button instead.

Rendering Link as another element (`render={<div />}`) adds `role="link"` and `tabindex="0"`
and opens links through a temporary anchor, but the element loses the browser's link
features (context menu, middle click, drag, status-bar URL); a development warning says so.

## Styling

Style it through the data attributes above, or import `@rind-ui/theme/link.css` (see
[component stylesheets](../theme/component-stylesheets.md)). Inline links keep their
underline by default (WCAG 1.4.1).

## Testing

```tsx
import { fakeRouter, getLink } from "@rind-ui/testing"

const router = fakeRouter()
render(
  <RouterProvider navigate={router.navigate}>
    <Link href="/docs">Docs</Link>
  </RouterProvider>,
)
await getLink(screen, { name: "Docs" }).follow()
await getLink(screen, { name: "Docs" }).via("keyboard").follow()
expect(router.calls).toEqual([
  { href: "/docs", routerOptions: undefined },
  { href: "/docs", routerOptions: undefined },
])
```

`follow()` on a disabled link fails, naming the action, the modality and `isDisabled: true`.

## Accessibility tree

Enabled, current, disabled and the `<div>` fallback (generated from the state stories):

<!-- aria:components-link--standalone -->
```yaml
- link "Documentation":
  - /url: "#docs"
- paragraph: "Router calls: none"
```
<!-- /aria -->

<!-- aria:components-link--current -->
```yaml
- link "Documentation":
  - /url: "#docs"
- paragraph: "Router calls: none"
```
<!-- /aria -->

<!-- aria:components-link--disabled -->
```yaml
- link "Documentation" [disabled]
- paragraph: "Router calls: none"
```
<!-- /aria -->

<!-- aria:components-link--as-div -->
```yaml
- link "Documentation"
- paragraph: "Router calls: none"
```
<!-- /aria -->

## Tested with

<!-- tested-with:link -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
