## 0. Prerequisites

- [ ] 0.1 Confirm `add-combobox` (pattern module), `add-listbox` (listbox parts), `add-collections`, `add-a11y-foundations`, `add-dialog`, `add-separator` and `add-theme-system` are applied; check the status of design.md "Requests to other changes" (popup-optional pattern, keywords)

## 1. Machine (`packages/core/src/components/command/command.machine.ts`)

- [ ] 1.1 One-state `command` machine spreading `patternActions`/`patternGuards` and `collectionActions`/`Guards` per design §1; `inputValue` controllable, `page` bound with `bindProp`, `onProps` for `collection` and `page.key`
- [ ] 1.2 Actions: `highlightFirst` (source `typing`, lagged active descendant), `runItem`, `clearQuery` (reasons `escape`, `page`), `callOnBack`, `onPageChange`, repair rules (append keeps highlight, results return → highlight first); root effects `announceCount`, `abortQuery`
- [ ] 1.3 Filtering derivation: `contains` over text value + keywords, custom matcher, `null`; never reorders
- [ ] 1.4 `node` tests for every machine-level scenario (initial state, Escape clear-then-unhandled, Backspace/onBack, page change, repair, IME guards, fake-clock activedescendant lag)

## 2. Connect and messages

- [ ] 2.1 `command.connect.ts`: pattern input props with `aria-expanded` from `exposed`, `aria-describedby` → Description, `enterKeyHint`; key handler only for the input target, `BACKSPACE_EMPTY` caret rule; listbox parts under `data-scope="command"`; `aria-selected="false"`; root `data-empty` / `data-loading` / `data-page`; `data-variant` / `data-size` pass-through
- [ ] 2.2 Link items: single activation on Enter with the keydown's modifiers (design §3); scroll-to-top in the results layout effect; nearest-scroller `scrollToHighlighted`
- [ ] 2.3 `command.messages.ts` (applicable pattern messages + `pageAnnouncement`)
- [ ] 2.4 Unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/command`)

- [ ] 3.1 Root, Label, Input, Description, List, Item, ItemText, ItemDescription, Group, GroupLabel, Separator, Empty, Loading; `render` on each; static items via collections registration (incl. `keywords`), data items via `collection`
- [ ] 3.2 React tests: Strict Mode, SSR + hydrate (no `aria-activedescendant` mismatch), inside add-dialog (keyboard, pointer and touch opens), two instances, 10,000 static items re-render budget

## 4. Contract and driver

- [ ] 4.1 `command.contract.ts` per design §5 (pattern fragment without `open`/`close`, traits, announcements, `optionsNeverSelected`, `{ skip }`, prop steps for `inputValue` and `page`)
- [ ] 4.2 `getCommand` in `@rind-ui/testing` (`run`, `back`, `items`, `highlighted`, `page`); driver tests in browser mode, jsdom and through Playwright against the site examples harness

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; issue-citing scenarios reproduce the issue first (Bug history in docs/research/command.md)
- [ ] 5.2 `testMachine` over the props classes of the "Model-Based Coverage" requirement, all modalities incl. `virtual`, RTL, Apple/WebKit, Apple/Blink and Windows platforms, IME replays, axe per state

## 6. Theme (`packages/theme/src/command.css`)

- [ ] 6.1 Tier-3 `--rind-command-*` tokens (design §6) defaulting to semantic tokens, `@layer rind.components`, `:where()` selectors, tokens read with a fallback and never declared; `data-variant` (solid, soft, outline, ghost) and `data-size` (sm, md, lg) family; `data-tone="danger"` items
- [ ] 6.2 Keyboard-highlight outline, forced colors (`Highlight`), 24×24 targets; Playwright forced-colors captures

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/command.tsx, state examples for every contract state): Default palette, groups + separators + keywords, dialog composition (⌘K wired in the example, not the component), nested pages, async loading/empty, consumer-ranked (`filter: null`), link items, virtualized
- [ ] 7.2 Driver example (docs testing example); all examples render with the theme stylesheet and pass axe (including colour contrast)

## 8. Docs and manual checks

- [ ] 8.1 Docs page (generated API facts + guide: Command vs Autocomplete vs Combobox, the dialog recipe, ranking with `filter: null` (match-sorter / command-score recipes), pages, app shortcuts and custom key bindings via `navigate`, migration from cmdk/shadcn, testing with `getCommand`)
- [ ] 8.2 Manual tier-1 pass (VO + Safari macOS/iOS, VO + Chrome, NVDA, JAWS, TalkBack; IME on macOS and Android); record mobile screen-reader findings for the open question
- [ ] 8.3 Set Command to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
