## Purpose

Defines the Link component: a single part that renders a navigational link following the
`link-navigation` rules, with its styling attributes, contract and driver.

## ADDED Requirements

### Requirement: Anatomy

Link SHALL be one part, `Link` (`data-scope="link"`, `data-part="link"`), rendering `<a>`
by default and accepting `render`. Its props SHALL be:

- `href`, `target`, `rel`, `download`, `ping`, `referrerPolicy`, `hrefLang`;
- `routerOptions`, `disabled`, `focusableWhenDisabled`, `current`;
- every attribute of the rendered element.

`href` and `routerOptions` SHALL be typed through a `RouterConfig` interface that
consumers can augment. Link SHALL have no machine. Its documentation SHALL mark it
stateless.

#### Scenario: Router types

- **WHEN** a consumer augments `RouterConfig` with `routerOptions: { replace?: boolean }`
- **THEN** `<Link href="/a" routerOptions={{ replace: true }} />` compiles and
  `routerOptions={{ foo: 1 }}` does not

### Requirement: Link Semantics

Link SHALL follow `link-navigation` for its element, disabled state, current state,
activation and routing. It SHALL take its accessible name from its content, or from
`aria-label` / `aria-labelledby` for an icon-only link. An empty name SHALL be reported
by the generic name invariant. Link SHALL NOT make itself part of any composite: it is
always its own Tab stop.

#### Scenario: Icon-only link without a name

- **WHEN** a Link contains only an `<svg>` without a title and has no `aria-label`
- **THEN** the generic accessible-name invariant fails naming the link

### Requirement: Keyboard Interactions

Link SHALL support these keys:

| Key | Behaviour |
|---|---|
| Enter | Activates the link (browser's native activation on `<a>`; press interactions on the non-anchor fallback) |
| ⌘/Ctrl + Enter | Opens in a new tab (native; synthetic anchor with modifiers on the fallback) |
| Shift + Enter | Opens in a new window (native) |
| Space | Nothing; the page scrolls as usual |
| Tab / Shift+Tab | Moves focus to the next / previous tabbable element; a disabled link is skipped unless `focusableWhenDisabled` |

#### Scenario: Ctrl+Enter

- **WHEN** a router is provided, the user focuses a same-origin link and presses Ctrl+Enter
  (⌘+Enter on macOS)
- **THEN** the router is not called and the browser opens a new tab

### Requirement: Router Provider

`@rind-ui/react` SHALL export `RouterProvider` with props `navigate` and optional `href`,
both plain functions. It SHALL supply the `Router` environment capability to every part
below it through `RindProvider`'s `environment` field, merging with any outer provider.
Without a `RouterProvider`, links SHALL navigate natively.

#### Scenario: Next.js app router

- **WHEN** an app renders `<RouterProvider navigate={router.push}>` from a client component,
  and a Link to `/about` is clicked
- **THEN** `router.push("/about", undefined)` is called once and the page does not reload

#### Scenario: Hooks-free API (react-spectrum#7028, react-spectrum#7220)

- **WHEN** a Link's `href` changes from `"/a"` to `undefined` and back under a
  `RouterProvider` with an `href` function
- **THEN** no React error is thrown and no hook is called conditionally

### Requirement: Link Data Attributes

Link SHALL expose the shared link data attributes of `link-navigation`:

| Part | Attributes |
|---|---|
| `link` | `data-scope="link"`, `data-part="link"`, `data-instance`, `data-current`, `data-disabled`, `data-external`, `data-focus`, `data-focus-visible`, `data-hover`, `data-pressed` |

It SHALL pass `data-variant`, `data-size` and `data-tone` through untouched.

#### Scenario: External link styling hook

- **WHEN** a Link points at another origin
- **THEN** it carries `data-external`, and a same-origin Link does not

### Requirement: Link Contract

Link SHALL ship a contract with scope `link` and anatomy `link`. The contract SHALL:

- locate an instance by role `link` and exact accessible name;
- declare these actions:
  - `follow`: pointer click and keyboard Enter; the virtual modality is a bare `click`.
    Its postcondition is that the router spy or the document location changed, or the
    contract's `navigated` hook resolved.
  - `followInNewTab`: pointer ⌘/Ctrl-click and keyboard ⌘/Ctrl+Enter.
  - `middleClick`: pointer only. Its keyboard implementation is declared `none` with the
    reason "no keyboard middle click; followInNewTab covers new-tab opening".
- declare queries `href` (rendered attribute), `current` (the `aria-current` value or
  `null`), `isDisabled`, `isExternal` and `isFocusVisible`;
- declare no traits.

`@rind-ui/testing` SHALL export `getLink` and `fakeRouter()`. `fakeRouter()` returns a
`Router` that records `navigate` calls and an optional `href` mapping, for use in
`RouterProvider` or a raw environment.

#### Scenario: Driver with a fake router

- **WHEN** a test renders a Link inside `RouterProvider` with `fakeRouter()` and runs
  `getLink(screen, { name: "Docs" }).follow()`
- **THEN** the fake router recorded one `navigate("/docs", undefined)` call, in the DOM
  adapter and in the Playwright adapter

#### Scenario: Keyboard twin

- **WHEN** a test runs `getLink(screen, { name: "Docs" }).via("keyboard").follow()`
- **THEN** Enter is pressed on the focused link and the same single navigation is recorded

#### Scenario: Disabled link driver

- **WHEN** a test runs `follow()` on a disabled link
- **THEN** it fails with a message naming `follow`, the modality and `isDisabled: true`
