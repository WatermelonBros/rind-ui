## Why

`domEnvironment()` builds every capability core defines in one object literal (announcer
live regions, clipboard, collection layout, constraint validity, page visibility, date
clock). The React provider calls it, so every component bundle carries all of them even
when its machine uses none: `Button` ships the live announcer, the clipboard fallback and
the collection layout reader. Measured on `@rind-ui/react/button`: about 5 kB minified,
1.5–2 kB gzip of capabilities it never reads.

## What Changes

- Capabilities split into a **base** (scheduler, DOM root, router, platform, modality,
  motion, pointer, style, locale, clock) and **on-demand capabilities** (announcer,
  clipboard, collection layout, constraint validity, page visibility, date clock), each
  declared as a capability object that knows its key, its environment option and how to
  build its DOM implementation.
- The React provider builds the base environment once and builds each on-demand
  capability the first time a component below asks for it, once per provider (one live
  announcer per provider, as today).
- A part asks for what its machine needs: `useEnvironment(announcer, clipboard)`. The
  returned type has exactly the base plus those capabilities, so a machine whose `env`
  needs a capability the part did not ask for is a compile error.
- Provider and `domEnvironment` options are unchanged: an `announcer`, `clipboard`,
  `visibility`, `dateClock` given there still wins over the default implementation.
- `domEnvironment()` stays public and complete for non-React consumers and tests;
  only the parts stop calling it.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `machine-runtime`: Injected Environment — base and on-demand capabilities; an
  on-demand capability is built only when requested.
- `react-adapter`: parts request on-demand capabilities from the provider; a missing one
  is a compile error.
- `bundle-size`: a component that does not request a capability does not ship its
  implementation.

## Non-goals

- Making modality on-demand: it is read by press, focus-visible and hover in almost every
  interactive component.
- Async or code-split capabilities: everything stays synchronous.
- Changing any capability's behaviour or the provider's props.

## Impact

- `packages/core/src/env/` (capability objects, base environment), `dom-environment.ts`
  rebuilt on top of them.
- `packages/react/src/provider.tsx` (`useEnvironment` signature), every part that uses an
  on-demand capability (about 30 that announce, plus Clipboard, Date Field/Calendar,
  Field-family, collection components).
- `packages/testing` env helpers if they construct partial environments.
- Size budgets lowered.
