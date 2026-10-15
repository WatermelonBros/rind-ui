## Context

See proposal.md for why. The binding sources are the Decisions in
[link.md](../../../docs/research/link.md) and these capabilities, which this change
consumes without restating them:

| From | Used for |
|---|---|
| `add-foundations` | `render` substitution, `mergeProps` (`preventRindHandler`), contracts, drivers, React adapter |
| `add-a11y-foundations` | press interactions (link-like parts: Enter only; bare-click activation), hover, modality and `data-focus(-visible)`, quirks registry, injected logger, `RindProvider environment` |
| `add-button` | `button-like-element`: disabled-link rule (no `href`, `role="link"`, `aria-disabled`), interactive-content warning |
| `add-theme-system` | stylesheet convention, tier-3 tokens |

## Goals / Non-Goals

**Goals:**
- One function, `linkProps`, decides every link part's attributes and click handling, so
  Breadcrumbs, Pagination and Navigation Menu cannot drift (as Separator's helper does for
  separators).
- Client routing that never double-navigates, never rewrites external URLs and needs no
  React hook.
- Zero runtime state: no machine, no subscriptions beyond press/hover/focus.

**Non-Goals:**
- Changing press interactions or `button-like-element`. Needs on them are listed in
  "Requests to other changes".

## Decisions

### 1. No machine

Link has no states and no events of its own. Press, hover and focus attributes come from
the `core/dom` modules every pressable part uses. As with Separator, the docs generator
marks it `stateless: true`. The page then omits the states table and the `testMachine`
section. A single-state machine would add bundle size and an empty graph.

### 2. `core/env/router.ts`

```ts
export interface RouterConfig {}                         // augmentable: { href?: …; routerOptions?: … }
export type Href = RouterConfig extends { href: infer H } ? H : string
export type RouterOptions = RouterConfig extends { routerOptions: infer O } ? O : never
export interface Router {
  navigate(href: Href, routerOptions: RouterOptions | undefined): void
  /** Pure, synchronous, deterministic (SSR). Not a hook. */
  href?(href: Href): string
}
export interface RouterCapability { readonly router?: Router }
```

`RindProvider`'s `environment` field already merges field by field. `RouterProvider` is
`<RindProvider environment={{ router: { navigate, href } }}>`, memoised on its two
functions. Routers whose basename helper is a hook (`useHref`) call it once in the
consumer's provider component. The docs show React Router (`basename` closure), Next.js
(`router.push`, `basePath` env) and TanStack Router (`router.buildLocation`).

*Alternatives:*
- RA's `useHref` hook in context. Rejected: react-spectrum#7028, #7220 and #9490.
- RA's current recommendation, "just `render` the router's Link". Supported as well: rule 4
  below makes it work. A provider is still needed for parts that render many links the
  consumer does not write (Pagination pages, collapsed breadcrumbs, menu items).

### 3. `core/dom/link.ts`

```ts
export interface LinkInput {
  href?: Href | undefined
  target?: string; rel?: string; download?: boolean | string; ping?: string
  referrerPolicy?: ReferrerPolicy; hrefLang?: string
  routerOptions?: RouterOptions
  disabled?: boolean; focusableWhenDisabled?: boolean
  current?: boolean | "page" | "step" | "location" | "date" | "time"
  onActivate?: (details: { href: Href; modality: Modality; disposition: "same-tab" | "elsewhere" }) => void
  tag: string                    // rendered tag from core/dom (server render: the default element)
  scope: string; part: string    // data-scope / data-part of the host part
}
export function linkProps(input: LinkInput, env: RouterCapability & PressEnv & ModalityEnv & DomEnv & Logger): LinkPartProps
export function shouldBrowserHandle(el: HTMLAnchorElement, e: MouseEvent | KeyboardEvent, doc: Document): boolean
export function openLink(href: string, attrs: SyntheticLinkAttrs, modifiers: Modifiers, env): void  // fallback + programmatic
// exported activation routine for parts that keep their own role (row, treeitem); the role="link" fallback props are built on it
export function activateLink(input: LinkInput, e: PressEvent, env): void
```

The output is the attribute rows in the spec plus one `onClick` (and, on the fallback, the
press handlers):

1. Disabled: no `href`, no client handler. `onClick` calls `preventDefault()` and
   `preventRindHandler`-style suppression of consumer handlers. This is the mergeProps
   "accessibility-critical" path: a disabled link part drops consumer `onClick`, and this
   is the only place a part may do that, per the spec.
2. `isExternal`: `new URL(resolvedHref, doc.baseURI).origin !== doc.location.origin`, which
   gives `data-external`. It is computed once per render, and on the server only for
   absolute URLs (it does not depend on the document).
3. `resolve(href)`: if `/^[a-z][a-z\d+.-]*:|^\/\//i` matches, or there is no router `href`,
   return `href`; otherwise return `router.href(href)`.
4. `onClick(e)` on an `<a>`:
   - if `e.defaultPrevented` → return;
   - compute the disposition (`elsewhere` if `shouldBrowserHandle`);
   - call `onActivate`;
   - if `same-tab` and there is a router → `preventDefault()` + `navigate(href, routerOptions)`.

   `shouldBrowserHandle` is RA's `shouldClientNavigate` inverted: button ≠ 0, a modifier,
   `getAttribute("target")` not in (null, `_self`), `download`, cross-origin.
5. Middle click: an `auxclick` with `button === 1` on an enabled anchor →
   `onActivate({ disposition: "elsewhere" })`. Nothing is prevented.
6. Fallback (non-anchor), when a `PRESS` comes from press interactions (Enter-only rule for
   role `link`) → `openLink(resolved, attrs, modifiers)`. `openLink` creates a detached
   `<a>` with the attributes, appends it to the element, dispatches `click` (or a `keydown`
   Enter under the `webkit-synthetic-click-modifiers` quirk), and removes it. The anchor's
   own click goes through rule 4, so routing and dispositions are identical.
7. Press state (`data-pressed`): the press module already ends a press on `pointercancel`.
   This change adds `blur` and `visibilitychange` (hidden) as press-end causes for link
   parts (request 1).

### 4. Quirk entries (`core/dom/quirks.ts`)

| Id | Condition | Workaround | Bug | Removal |
|---|---|---|---|---|
| `talkback-unfocusable-link` | always (no UA sniffing is possible for TalkBack) | disabled / current-without-href links get `tabindex="-1"` | react-spectrum#3998, Google 267670776 | Android bug fixed and verified in the yearly re-test |
| `webkit-synthetic-click-modifiers` | macOS WebKit, not iPad | `openLink` dispatches `keydown` Enter with modifiers | WebKit `HTMLAnchorElement.cpp` (RA `openLink.tsx`) | WebKit honours modifiers on synthetic clicks |

### 5. Parts (React)

`<Link>` = `useEnvironment()` + `linkProps({ ...props, tag: useRenderedTag(ref), scope:
"link", part: "link" }, env)` + press/hover/focus factories + `mergeProps` + `render`.
It has no context and no store. `RouterProvider` is described in §2.

### 6. Contract

```ts
export const linkContract = contract("link", {
  anatomy: ["link"],
  locate: { part: "link", role: "link", name: true },
  actions: {
    follow: { pointer: ({ part }) => part("link").click(), keyboard: ({ part, keyboard }) => part("link").focus().then(() => keyboard.press("Enter")), done: ({ env }) => env.navigated() },
    followInNewTab: { pointer: …click({ modifiers: ["Mod"] }), keyboard: …press("Mod+Enter"), done: ({ env }) => env.navigated({ newTab: true }) },
    middleClick: { pointer: …click({ button: "middle" }), none: { keyboard: "no keyboard middle click; followInNewTab covers new-tab opening" }, done: … },
  },
  queries: { href, current, isDisabled, isExternal, isFocusVisible },
  traits: [],
})
```

`env.navigated()` is satisfied by the `fakeRouter()` spy (through an adapter hook) or, in
Playwright, by a URL change or a new page event. `fakeRouter` lives
in `@rind-ui/testing` (`fake-router.ts`).

### 7. Theme

`packages/theme/src/link.css`:

- tokens `--rind-link-color`, `-color-hover`, `-color-visited`, `-decoration`, `-underline-offset`,
  `-current-weight`, `-disabled-color`, `-focus-ring`;
- underline by default (WCAG 1.4.1 for inline links);
- `[data-current]` weight;
- `[data-disabled]` uses `GrayText` in forced colors;
- `[data-focus-visible]` gets an outline;
- no variant or size: links inherit font size.

Family: a new `link` row (request 2).

### 8. Shared modules used

From `core/dom`: `press`, `hover`, `modality`, `quirks`, and the new `link`. From
`core/env`: the new `router`. Nothing from `core/collection` or the overlay modules.

## Requests to other changes

1. **add-a11y-foundations (`press-interactions`), additive.** End a press, without
   activating, when the pressed element loses focus or the document becomes hidden.
   Without it a link that opens a new tab with Enter stays `data-pressed`
   (react-spectrum#6094). If press interactions already end on blur, only the
   `visibilitychange` case is new.
2. **add-theme-system (`theme-variants`, Family Matrix).** Add the row `link | Link,
   Breadcrumbs link, Navigation Menu content link | — | — (inherits font size)`. Breadcrumbs
   reuses it. **APPLIED (coordinator, 2026-10-14).**
3. **add-button (`button-like-element`), additive.** A button-like part rendered as `<a
   href>` SHALL take its navigation behaviour from `link-navigation` (routing, modifier
   clicks, `href` resolution), so `render={<a href>}` on a Button routes like a Link
   (react-spectrum#10603). **APPLIED (coordinator, 2026-10-14).**
4. **add-menu ("Link Items") and add-toolbar ("Buttons And Links"), optional.** Build link
   items with `linkProps` and close only on `disposition: "same-tab"`. Behaviour is
   unchanged: both specs already require modifier clicks to keep the browser default. It
   would add client routing for menu links rendered as plain `<a href>`. **APPLIED (coordinator, 2026-10-14).**

Requests from other changes, already satisfied here: add-pagination request 1
(`focusableWhenDisabled` on `linkProps`, and an activation report that distinguishes a
same-tab navigation) and add-navigation-menu's activation hook, both covered by
`onActivate`'s `disposition`.

## Risks / Trade-offs

- [Disabled links drop consumer `onClick`, which goes against the general merge rule] →
  limited to the disabled state, specified in `link-navigation`. Consumers who need a
  click on a disabled link should render a Button.
- [`tabindex="-1"` on disabled links for a TalkBack bug] → recorded as a quirk with a
  removal condition, re-tested yearly.
- [Router `href` as a plain function cannot call hooks] → documented per router. The
  hook is called once in the consumer's provider.
- [The origin check in a sandboxed iframe with an opaque origin] → an opaque origin never
  equals a URL origin, so every link is left to the browser. This is the safe direction.

## Open Questions

- Should `data-external` be computed during the server render for root-relative URLs (they
  are always same-origin)? Yes in practice. It is listed here only so the SSR test pins it.
