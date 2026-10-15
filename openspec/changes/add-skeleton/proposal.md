## Why

Skeleton placeholders are a WCAG failure in most apps: nothing tells a screen-reader
user that a region is loading, the grey boxes (or the stale text they wrap) are read or
tabbed into, and the shimmer ignores reduced motion (mui/material-ui#31363, #49442).
Libraries leave all of it to the consumer because "many skeletons, one loading area"
(mui/material-ui#28057), or put roles on each box (Kobalte's unnamed `group`s). A
headless Skeleton can own the area: busy flag on the region, hidden and inert
placeholders, a findable loading text outside the busy element (adobe/react-spectrum#8479),
an optional completion announcement, and a theme shimmer that stops for reduced motion.

Research: [skeleton](../../../docs/research/skeleton.md) (sources, Bug history,
Accessibility, Decisions) · [accessibility](../../../docs/research/accessibility.md)
§7, §8, rules 10, 23, 26 · [assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.2 D, K · [native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (archived: runtime, read-only prop bindings with
`$sync`, effects, contracts, drivers, `testMachine`, React adapter),
`add-a11y-foundations` (Announcer, `messages`, `core/dom/visually-hidden`, inert value
across React versions, reduced-motion preference, invariants) and `add-theme-system`
(tokens, motion tokens, family matrix — a request is listed in design.md).

## What Changes

- `@rind-ui/core`: `skeleton` machine (`loading`/`loaded` bound to the `loading` prop),
  connect, contract, messages (`loading`, `loaded`).
- Behaviour: Root holds the loading state; Content (the region) has `aria-busy` while
  loading; every Item is `aria-hidden` (and `inert` when it wraps content) while
  loading; Status renders a visually hidden "Loading" text outside Content while
  loading; optional polite announcement on `loading → loaded`; no live regions; no
  inline styles.
- `@rind-ui/react`: `Skeleton.Root`, `Status`, `Content`, `Item`.
- `@rind-ui/testing`: `getSkeleton` driver.
- Theme stylesheet (`--rind-skeleton-*`: synchronized CSS shimmer, off under reduced
  motion, forced-colors fill), stories, docs page.

## Capabilities

### New Capabilities

- `skeleton`: the Skeleton component — anatomy, busy region, hidden placeholders,
  loading text, completion announcement, reduced motion, `data-*`, contract and
  driver, theme.

### Modified Capabilities

None. The theme family request is listed in design.md "Requests to other changes".

## Non-goals

- A skeleton-aware variant of every component (React Spectrum's context reaching into
  Text, Image and form controls): composition with `Skeleton.Item` instead.
- Size, shape and radius props (`width`, `height`, `circle`, `radius` in Kobalte):
  consumer CSS and theme tokens.
- `role="progressbar"` or determinate progress: Progress, referenced from the region by
  the consumer's `aria-describedby` (documented).
- Moving focus when content arrives; focus restoration for controls replaced by the
  load (consumer).
- A JavaScript-synchronised shimmer; fx.
- Framework adapters other than React.

## Impact

- New code: `packages/core/src/components/skeleton/{skeleton.machine,skeleton.connect,skeleton.contract,skeleton.messages}.ts`,
  `packages/react/src/skeleton/*`, `getSkeleton` in `@rind-ui/testing`,
  `packages/theme/src/skeleton.css`, stories, generated docs page.
- Public API: `skeleton` machine/connect/contract, `Skeleton` parts, `getSkeleton`.
- Reado: optional adoption for the editor and notebook loading placeholders.
- No new runtime dependency.
