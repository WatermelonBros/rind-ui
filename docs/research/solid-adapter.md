# Solid adapter — research

Status: done · Wave: infrastructure

How the libraries that ship SolidJS bindings bind a headless core, what went wrong for them,
and which platform facts decide `@rind-ui/solid`. The component behaviour is unchanged
(machines and connect are shared), so the per-component research notes still apply as
written; [framework-adapters.md](framework-adapters.md) (Vue, Svelte) and
[angular-adapter.md](angular-adapter.md) are the sibling notes.

Versions checked (npm, 2026-10-24): `solid-js` 1.9.17 (`latest`), 2.0.0-rc.18 (`next`);
`@kobalte/core` 0.13.14 (`alpha` 2.0.0-alpha.4 for Solid 2); `@ark-ui/solid` 5.39.3 (`next`
6.0.0-next.0); `@zag-js/solid` 1.46.0 (`next` 2.0.0-next.3); `vite-plugin-solid` 2.11.14
(`next` 3.0.0-next.27); `babel-preset-solid` 1.9.16.

## How the others built it

### Zag / Ark UI (Solid)

- Source: `@zag-js/solid` `dist/normalize-props.mjs`, `machine.mjs`; `@ark-ui/solid`
  `dist/components/factory.*`, `dist/chunk/*` (`withAsProp`).
- `normalizeProps` renames React-cased connect props: `onFocus → onFocusIn`,
  `onBlur → onFocusOut`, `onDoubleClick → onDblClick`, `onChange → onInput`,
  `defaultValue → value`, `defaultChecked → checked`, `htmlFor → for`,
  `className → class`; camelCase style keys are hyphenated (custom properties kept), non
  string/number style values dropped; `readOnly: false` dropped; a string `children` becomes
  `textContent`, any other `children` is dropped.
- `useMachine` keeps the props behind a `createMemo` over an accessor; each context value is
  a "bindable" signal; effects start in `onMount`, stop in `onCleanup`.
- `asChild` is a function: `asChild={(props) => <a {...props()} />}`. The part passes a
  props *function* (`(user) => mergeProps(rest, user)`) so the consumer's own props are
  merged in at the call. The part's `ref` is split off before the call.
- Exports: `"solid": "./dist/*.jsx"` (JSX kept, compiled by the consumer's Vite plugin for
  the DOM or the server) and `"default": "./dist/*.js"` (compiled for the DOM).
  Peer `solid-js >=1.6.0`.
- Problems: the first `as`-prop design merged prop types into an unusable union and was slow;
  replaced by function `asChild` in Ark Solid 3.0 (#2052, #2331). `asChild` did not forward
  `class` to an SVG child (#2007: the clone helper checked `instanceof HTMLElement`). `asChild`
  on inputs did not work (#2559). A `null` value was read as uncontrolled (changelog 5.38).

### Kobalte (`@kobalte/core`)

- Polymorphic parts: `as` takes a tag or a component and renders through `<Dynamic>`.
  Parts use `splitProps` for their own keys and `mergeDefaultProps`; refs are combined with
  `mergeRefs`.
- Exports: the same `solid` (`.jsx`) + `default` (`.js`) pair, also per component
  (`"./*"`). Peer `solid-js ^1.9.8`.
- Problems (issue tracker): a Label's `for` missing in server HTML (#652, ids made after
  mount); Accordion `defaultValue` ignored during SSR (#226) and broken under SolidStart SSR
  (#385); a hidden native select importing `use` from `solid-js/web` into the server build
  (#542: compiled DOM code reached the server); a controlled text field never updating when
  its first controlled value is `undefined` (#627: controlled-ness decided once); a Button
  rendered as a non-button element not activated by the keyboard (#712). Under Solid 2 RC: the
  default Button loses hydration for reactive children through `Polymorphic` → `Dynamic`
  (#717; root cause solid #3797, hydration keys shifted by memo-wrapped prop getters read
  before `children`), and DismissableLayer never registering its layer, so a modal Dialog
  ignores Escape and outside clicks (#755).

### Corvu

- Per-primitive packages (`@corvu/dialog` 0.2.4, last release 2025-01). Same
  `Dynamic`-based polymorphism. Not maintained against Solid 2; not used as a reference beyond
  confirming the pattern.

## Platform facts that decide the design

- **Props are reactive getters.** A component runs once; reading `props.x` inside a
  computation tracks it. Destructuring (or reading outside a tracking scope) freezes the
  value. Parts must use `splitProps` for their own keys and pass the rest through.
- **`mergeProps` does not chain handlers.** Solid's `mergeProps` returns, per key, the last
  source that defines it (verified in `solid-js` 1.9.17 `dist/solid.js`), so the consumer's
  `onClick` would replace the part's. Handler composition has to go through core's
  `mergeProps` (`@rind-ui/core/internal`, which chains them and honours
  `preventRindHandler()`), evaluated inside a `createMemo` so it re-runs when either side
  changes; the memo's object is spread on the element (`<button {...props()} />`), which the
  compiler turns into a reactive spread.
- **Event delegation.** `onClick`, `onKeyDown`, `onInput`, `onFocusIn`, `onPointerDown` and
  the rest of `DelegatedEvents` (`beforeinput click dblclick contextmenu focusin focusout
  input keydown keyup mousedown mousemove mouseout mouseover mouseup pointerdown pointermove
  pointerout pointerover pointerup touchend touchmove touchstart`) are handled by one listener
  on `document`; other events (`onFocus`, `onScroll`, `onLoad`…) are native. React delegates
  to its root too, so core's `dom/` modules (native listeners, `stopPropagation` on handled
  keys) already work with delegation; a portal in a shadow root needs
  `delegateEvents` on that root.
- **Connect is already neutral** (`onFocusIn`, `onInput`, `onDblClick`, HTML attribute
  names, kebab style keys): Solid accepts those names as they are. The normalizer only folds
  React spellings back (`neutralName`), drops `children` (the part renders it) and writes
  `defaultValue` / `defaultChecked` as `value` / `checked` (set once: the prop never changes,
  so the user's edits stay; the server HTML carries the attribute).
- **No element cloning.** There is no virtual DOM; a part cannot take a child element and
  add props to it. Element substitution can only be a function the consumer calls with the
  props.
- **Ids:** `createUniqueId()` is stable between server and hydration (it reads the
  hydration context); in a client-only render it counts.
- **Portal wraps.** `solid-js/web` `Portal` creates a `<div>` (`<g>` with `isSVG`) inside
  the mount node and renders into it (verified in `web/dist/web.js`), so its markup differs
  from React's `createPortal` (no wrapper).
- **Two builds of the runtime.** `solid-js/web` resolves to `web/dist/server.js` under the
  `node`, `worker` and `deno` conditions and to the DOM build under `browser`. A test in a
  Node process (jsdom) must resolve `browser` first, or `render` throws "client-only API
  called on the server side". Server HTML needs the components compiled with
  `generate: "ssr"` and the server runtime.
- **Hydration markers.** Server HTML carries `data-hk` keys on elements and `<!--$-->` /
  `<!--/-->` comment markers around dynamic text; both are Solid's, not ours, and must be
  stripped before comparing with React's markup.
- **Compilation.** JSX is compiled by `babel-preset-solid` (dom-expressions); neither oxc nor
  esbuild can. In Vite, `vite-plugin-solid` 2.11 (Vite 3–9) runs it; its `include` must be
  scoped to `packages/solid` so the repo's React `.tsx` files keep the React JSX transform.
- **Solid 2 is a release candidate with daily RCs** (rc.17 and rc.18 one day apart). Its
  breaking changes include `onMount` → `onSettled`, a rebuilt reactive core with async
  computations, and the web runtime moving to `@solidjs/web`; the ecosystem's 2.0 lines are
  all pre-release, and Kobalte's 2.0 alpha shows hydration and layer bugs (#717, #755).

## Mapping from React

| React (`@rind-ui/react`) | Solid (`@rind-ui/solid`) |
|---|---|
| `<Toggle.Root>` renders a `<button>` | Same: `<Toggle.Root>` renders a `<button>`; one static JSX element per part (no `Dynamic` on the default path, #717) |
| `render` (element or function) | `render` function only: `render={(props, state) => <a {...props} />}` (no cloning) |
| `mergeProps` (consumer first, `preventRindHandler()`) | core's `mergeProps` inside `createMemo`, spread reactively; never Solid's `mergeProps` for handlers |
| `ref` / `composeRefs` | `ref` prop (callback or variable); a small `composeRefs` for the part's own ref |
| Context (`createContext`) | `createContext` / `useContext` with accessor values; a part outside its root throws |
| Children as a function (state) | `children` as a function of the state accessor, or `render` |
| Controlled `pressed` + `onPressedChange` | Same names; controlled while `props.pressed !== undefined`, read reactively on every access (never decided once, #627) |
| `useId` | `createUniqueId()`; the `id` prop overrides |
| Effects (`useEffect` / layout effects) | `onMount` / `createEffect` / `onCleanup`, behind one `lifecycle` module so Solid 2's `onSettled` is a one-file change |
| Portal (`createPortal`) | an own portal (`insert` into the layer container, no wrapper `<div>`), so layered markup matches React |

## Bug history

- Kobalte #627 (controlled-ness decided at the first value), #652 (Label `for` missing in
  SSR), #226 / #385 (`defaultValue` and Accordion under SSR), #542 (DOM-compiled code in the
  server bundle), #712 (non-button Button not keyboard-activatable), #717 / solid #3797
  (Solid 2 hydration through `Dynamic`), #755 (Solid 2 layer registration).
- Ark UI #2052 / #2331 (the `as` prop's type union and speed), #2007 (`class` lost on SVG
  children through `asChild`), #2559 (`asChild` on inputs), 5.38 (`null` read as
  uncontrolled).
- SolidStart #1089 / #1110 / #1752 (hydration-key mismatches with `Dynamic` under `Show`,
  components from `node_modules` compiled the wrong way, attributes read from props during
  hydration).

## Testing notes

- Browser mode (Playwright) with `vite-plugin-solid` scoped to `packages/solid/**`, and
  `resolve.conditions` putting `browser` (and `solid`) first for the Solid project.
- A `mount` fixture over `solid-js/web` `render` with a store for the props (rerender =
  set the store), like the Vue and Svelte fixtures; no `@solidjs/testing-library` dependency.
- React's contract models (`packages/testing/src/components/*.model.dom.test.tsx`) run
  against the Solid parts through the same drivers; parity with React through
  `canonicalHtml` after stripping `data-hk` and Solid's comment markers.
- Server HTML and hydration: a fixture bundled twice with Rolldown and `babel-preset-solid`
  (`generate: "ssr"`, `hydratable: true` for the server; `generate: "dom"`, `hydratable: true`
  for the client), rendered with the server runtime and hydrated with zero warnings, as
  `packages/svelte/fixtures/ssr.ts` does for Svelte.

## Decisions

1. Target `solid-js` 1.9 (peer `>=1.9.0 <2`). Solid 2 waits for a stable release and its own
   change; the lifecycle calls live in one module so the move is small.
2. Parts render one static element each; element substitution is a `render` function.
3. Handlers compose through core's `mergeProps` in a memo, spread on the element.
4. Ship JSX under the `solid` condition (`dist/**/*.jsx`) and DOM-compiled `dist/**/*.js` as
   `default`, per component subpath, like Ark and Kobalte; the server build comes from the
   consumer's compiler through the `solid` condition (#542).
5. Build with tsdown and a small Rolldown plugin running `babel-preset-solid` (dev
   dependencies `babel-preset-solid`, `@babel/core` 7); no new runtime dependency. A
   decision record covers the toolchain.
6. Own portal without a wrapper element.

## Sources

- npm registry: `solid-js`, `@kobalte/core`, `@ark-ui/solid`, `@zag-js/solid`,
  `vite-plugin-solid`, `babel-preset-solid`, `@corvu/dialog` (versions and dist-tags).
- Source read from the published packages: `@zag-js/solid` 1.46.0, `@ark-ui/solid` 5.39.3,
  `@kobalte/core` 0.13.14, `solid-js` 1.9.17 (`dist/solid.js`, `web/dist/web.js`).
- [Kobalte #717](https://github.com/kobaltedev/kobalte/issues/717),
  [#755](https://github.com/kobaltedev/kobalte/issues/755),
  [#627](https://github.com/kobaltedev/kobalte/issues/627),
  [#652](https://github.com/kobaltedev/kobalte/issues/652),
  [#542](https://github.com/kobaltedev/kobalte/issues/542),
  [#712](https://github.com/kobaltedev/kobalte/issues/712),
  [#226](https://github.com/kobaltedev/kobalte/issues/226),
  [#385](https://github.com/kobaltedev/kobalte/issues/385),
  [PR #746](https://github.com/kobaltedev/kobalte/pull/746).
- [solid #3797](https://github.com/solidjs/solid/issues/3797),
  [Solid 2.0 beta release](https://github.com/solidjs/solid/releases/tag/v2.0.0-beta.0),
  [The Road to 2.0](https://github.com/solidjs/solid/discussions/2425).
- [Ark #2052](https://github.com/chakra-ui/ark/issues/2052),
  [#2331](https://github.com/chakra-ui/ark/issues/2331),
  [#2007](https://github.com/chakra-ui/ark/issues/2007),
  [#2559](https://github.com/chakra-ui/ark/issues/2559),
  [Ark changelog](https://ark-ui.com/docs/overview/changelog).
- SolidStart [#1089](https://github.com/solidjs/solid-start/issues/1089),
  [#1110](https://github.com/solidjs/solid-start/issues/1110),
  [#1752](https://github.com/solidjs/solid-start/issues/1752).
