## Why

Password Input and Search Field are Text Fields with one more behaviour each. As separate
components they duplicate the anatomy, the docs, the site examples, the theme and the test
drivers, and they make consumers pick a component where a native `type` would do. User
decision (2026-10-17): they become Text Field parts and options. Unreleased: no migration
period.

## What Changes

- **BREAKING** `PasswordInput` and `SearchField` (React parts, core machines, connects,
  contracts, messages, metas, `getPasswordInput`, `getSearchField`, theme stylesheets, site
  examples, docs pages) are removed.
- Text Field Root gains `type` (the Input's native type): `"password"` adds the visibility
  behaviour (`visible` / `defaultVisible` / `onVisibleChange`, the `VisibilityTrigger` and
  `VisibilityIndicator` parts, hide on submit and reset, privacy attributes, caret kept);
  `"search"` adds search semantics (`searchbox`, `enterKeyHint="search"`, "Clear search").
- Text Field Root gains `escapeClears` (Escape clears a non-empty editable value and is
  consumed only then; default `true` for `type="search"`, else `false`) and `onSubmit(value,
  details)` (Enter, not composing; never prevents the form's submission).
- One Text Field machine and contract (scope `text-field`) hold all of it; the preset builder
  stays an internal detail.
- Specs: the `password-input` and `search-field` requirements move into `text-field`.

## Impact

- `packages/core/src/components/{text-field,password-input,search-field}`,
  `packages/react/src/{text-field,password-input,search-field}`, `packages/testing`
  (drivers, fixtures, tests), `packages/theme` (`text-field.css` absorbs the two
  stylesheets), `apps/site` (examples and skins), `docs/components`, `docs/components.md`.
