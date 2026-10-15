## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure` and `add-theme-system` are applied (`add-heading` only for the Title recipe story)

## 1. Machine

- [ ] 1.1 `alert.machine.ts` per design §2: `open`/`closed`, controllable `open` (default true), `ROOT.MOUNT { hydrating, text }`, `CONTENT.CHANGE`, `CLOSE`, guards `canAnnounce`/`isMounted`/`textChanged`, actions `announceText` (keyed per instance, locale, empty skipped), `prepareAnnouncer`, `moveFocusIfInside` before notifying
- [ ] 1.2 Node tests with the recording announcer: one message per client mount, per `$sync:open → open` and per text change while open; none while hydrating, with `announce="off"`, while closed or on dismissal; Strict-Mode double mount collapses to one; `assertive`/`polite` passed through (chakra-ui#3240, mui/material-ui#40198, #49440, ariakit#7235)

## 2. Connect, DOM helpers and messages

- [ ] 2.1 `alert.connect.ts` per design §4 (no role / live attributes; Icon `aria-hidden` or `role="img"` + label; CloseTrigger name from `messages.dismiss` only when nameless; ids for Title/Description; `data-*`; consumer attributes passed through); dev warnings for consumer live role/attrs and missing focus target
- [ ] 2.2 `core/dom/alert-text.ts`: `announceableText` (Icon label, Title, Description or Root; skips `aria-hidden`, `hidden`, CloseTrigger) and `observeText` (MutationObserver, emits only on joined-text change); browser tests
- [ ] 2.3 `alert.messages.ts`: `dismiss`, `announcement(segments)` (English: terminal punctuation rule); unit tests

## 3. React parts (`packages/react/src/alert`)

- [ ] 3.1 Root (hydration flag via `useSyncExternalStore` server snapshot, `ROOT.MOUNT` from the mount effect, `observeText` wiring, presence), Icon, Title, Description, CloseTrigger; `render` on each
- [ ] 3.2 React tests: SSR + hydrate (no announcement, no mismatch), client mount (one), Strict Mode (one), keyed reorder (none), controlled unmount on close keeps focus off `body`

## 4. Contract and driver

- [ ] 4.1 `alert.contract.ts` per design §5 (locate by Title text or within, `dismiss` with pointer/touch/keyboard, queries, `presence` trait, `{ skip }` entries with reasons, `$sync:open` and `$props:children` steps)
- [ ] 4.2 `getAlert` in `@rind-ui/testing` with the announcement log; driver tests in browser mode, jsdom and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(alertContract, …)` over the props classes of design §5 in pointer, keyboard and virtual modalities; announcement-count oracle; focus never on `body` after dismissal from inside; rule-23 invariant passes for Alert and fails for a `role="alert"` wrapper; axe per state

## 6. Theme (`packages/theme/src/alert.css`)

- [ ] 6.1 `@layer rind.components`, `:where()` selectors, `--rind-alert-*` tokens read with fallbacks and never declared; grid layout with logical areas (RTL mirror); `status` family variants and sizes, every `data-tone`; CloseTrigger ≥ 24×24; forced-colors border and `currentColor` icon; exit transition on duration tokens; imported from `index.css`
- [ ] 6.2 Playwright captures: each tone × variant, RTL, forced colors, reduced motion; builder contrast check of text on every tone × variant

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Themed stories: static banner (announce off), error after an action (assertive), status that updates (polite), dismissible with focus moving to the next control, icon-labelled severity, Title as `Heading`, region recipe, inside a form as an error summary (consumer focus), driver example with `announcements`; ARIA snapshots per state; axe clean

## 8. Docs

- [ ] 8.1 Docs page (generated API facts): when to use which `announce`, why there is no `role="alert"` and what to do if you add one, page-load silence, the text that is announced and `announcement`, severity in text, dismissal and `finalFocus`, error-summary recipe, Alert vs Toast vs Alert Dialog, driver example, `llms.txt` entry
- [ ] 8.2 Migrate Reado's alerts (design Migration Plan) in a Reado change once released; set Alert to `wip`/`done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from coordinator)

- [ ] A.1 `announce` defaults to `"polite"` (not `"off"`): `canAnnounce` and `prepareAnnouncer` treat a missing prop as `"polite"`; client-mounted alerts without `announce` announce once politely, server-rendered ones stay silent; `"off"` and `"assertive"` unchanged; tests for the "Polite by default" and updated "Danger tone without announcement" scenarios; docs and stories say when to set `"off"`
