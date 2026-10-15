## Why

Links are rendered by many rind-ui parts: Link, Breadcrumbs, Pagination, Navigation Menu,
menu link items, toolbar links, and buttons rendered as `<a>`. Every library got one of the
same rules wrong. Examples: Enter activating twice or not reaching the router, disabled links
that still open on middle click, routers that rewrite external URLs, current items that
TalkBack cannot reach. So the rules are specified once here, with a small public Link
component as their first user. Breadcrumbs, Pagination and Navigation Menu (wave 2) depend
on it.

Research note: [docs/research/link.md](../../../docs/research/link.md) (with
[accessibility](../../../docs/research/accessibility.md) §1.4 and §5,
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
cause A, [native-platform](../../../docs/research/native-platform.md)).

Depends on:

- `add-foundations`: `render` substitution, contracts, drivers, the React adapter.
- `add-a11y-foundations`:
  - press interactions (Enter-only for link-like parts);
  - modality and focus attributes;
  - the quirks registry, messages, logger;
  - `RindProvider`'s `environment` field.
- `add-button`: `button-like-element` (disabled-link rule, interactive-content warning).
- `add-theme-system`: the stylesheet convention.

## What Changes

- **Shared `link-navigation` capability**, used by every part that renders a link:
  - `linkProps(input, env)` (`core/dom/link.ts`) and the injected `Router` environment
    capability (`core/env/router.ts`: `navigate(href, routerOptions)`, optional pure
    `href(href)`).
  - Native `<a href>` first. Non-anchor elements get the fallback.
  - Disabled links: no `href`, `role="link"`, `aria-disabled`, `tabindex="-1"`.
  - `aria-current` and `data-current`.
  - Modifier, middle and other-target clicks are left to the browser.
  - Client-side routing when a router is provided.
  - An `onActivate` report with a disposition (`same-tab` / `elsewhere`) for containers.
- **Link component**:
  - one React part `<Link>` with `render`;
  - connect; no machine (stateless);
  - contract and `getLink` driver;
  - `fakeRouter()` test helper;
  - theme stylesheet, stories, docs page.
- `@rind-ui/react` `RouterProvider`: a typed wrapper over `RindProvider environment={{ router }}`.
- Quirk entries:
  - `talkback-unfocusable-link`;
  - `webkit-synthetic-click-modifiers`.

## Capabilities

### New Capabilities

- `link-navigation`: rules shared by every link-rendering part. It covers:
  - element and role;
  - disabled links;
  - current state;
  - activation and modifier clicks;
  - client routing;
  - href resolution;
  - activation reports.
- `link`: the Link component. It covers:
  - parts;
  - `data-*`;
  - messages;
  - the contract and driver.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes. The additive
needs on them are listed in design.md "Requests to other changes".

## Non-goals

- Automatic `aria-current` from the router (NavLink behaviour). Use `render` with the
  router's NavLink, or compute `current` (react-spectrum#5664).
- Links as table rows, grid cells or other elements that cannot be anchors (Table/Grid List
  own that). The non-anchor fallback here is for `render` only.
- Prefetching (`preload`, react-spectrum#9470): this belongs to the router's own Link,
  rendered through `render`.
- External-link text ("opens in a new tab"). `data-external` is a styling hook only.
- A press-event API (`onPress`) on Link: links activate through the native `click`
  (`onClick`). `onActivate` exists for containers.
- Framework adapters other than React; fx.

## Impact

- New code:
  - `packages/core/src/dom/link.ts`, `packages/core/src/env/router.ts`;
  - `packages/core/src/components/link/` (connect, contract, messages);
  - two entries in `core/dom/quirks.ts`;
  - `packages/react/src/link/` (`Link`, `RouterProvider`);
  - `getLink` and `fakeRouter` in `@rind-ui/testing`;
  - `packages/theme/src/link.css`;
  - stories and the docs page.
- Public API: `Link`, `RouterProvider`, `linkProps`, the `Router` type,
  `RouterConfig` (module augmentation for `href`/`routerOptions` types), `getLink`,
  `fakeRouter`.
- No new dependency.
