## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-checkbox`, `add-field` and `add-button` are merged

## 1. Machine (`components/form/form.machine.ts`)

- [ ] 1.1 Types and the machine per design §2: registration, attempt grouping of `invalid` events, `idle` / `validating` / `awaiting-server`, tree-order focus, resubmit with the submitter, `errors` read-only prop applied by identity
- [ ] 1.2 Node tests: one-shot focus (ariakit#6307), removed fields (base-ui#2228), cross-field revalidation (radix#2566), programmatic `validate()` (ariakit#2397), async hold and replacement, summary announcement counts

## 2. Connect (`components/form/form.connect.ts`)

- [ ] 2.1 Root props: `novalidate` only in `aria` behaviour, capture listeners for `submit` / `invalid` / `reset`, data attributes; `form.messages.ts` (`invalidSummary`)
- [ ] 2.2 `onFormSubmit` values from registered Fields; unit test with Text Field, Checkbox and Checkbox Group values

## 3. React part (`packages/react/src/form/`)

- [ ] 3.1 `Form.Root` with a fresh context per instance (react-spectrum#10740), the imperative `validate`, action-reset detection per design §3 and its quirk entry
- [ ] 3.2 React 19 tests: `useActionState` errors survive the automatic reset (react-spectrum#6830, #7708); prevented reset (react-spectrum#7602)

## 4. Contract and driver

- [ ] 4.1 `form.contract.ts`: anatomy, locate by role `form` + name, actions `submit` / `reset` / `validate`, queries, states, events, `formInvariants`
- [ ] 4.2 `getForm` driver with announcements; same test in `browser`, `jsdom` and Playwright

## 5. Model-based tests

- [ ] 5.1 `testMachine(formContract, …)` over a story with three Fields (one async), configurations: default, `change` mode, `aria` behaviour, server errors via prop steps; all modalities
- [ ] 5.2 Broken variants: registration-order focus (base-ui#5284), focus on later item changes, per-field announcements on submit

## 6. Browser tests

- [ ] 6.1 Native sequence: invalid events grouped into one attempt, Enter implicit submission from a Text Field and from a Checkbox, `requestSubmit(submitter)` after async settle, server errors focus, nested name mapping (ariakit#3607), two Fields with one name (radix#2380)

## 7. Theme

- [ ] 7.1 `packages/theme/src/form.css`: `@layer rind.components`, `:where()` selectors, `--rind-form-gap` read with fallback (never declared), no variant family, a `data-tone="danger"` capture of a failed form; imported from `index.css`

## 8. Stories

- [ ] 8.1 Stories: sign-up form (client validation), async username, server errors (simulated), React 19 `useActionState`, `onFormSubmit` values output, `aria` behaviour, form in a dialog (nested), reset; every story passes axe

## 9. Docs

- [ ] 9.1 Generated docs page: anatomy, props, `data-*`, states, submission sequence, server errors, reset rules (user vs framework), announcements, driver example; `llms.txt` entry; recipe: error summary list with links

## 10. Proof

- [ ] 10.1 Manual tier-1 protocol: failed submit with 1 and 3 errors (NVDA, JAWS, VO macOS/iOS, TalkBack) — focus lands on the first, its error is read, the summary is spoken once
- [ ] 10.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
