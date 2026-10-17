## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-collections`, `add-button` and `add-theme-system` are applied

## 1. Machine (`core/components/tag-group`)

- [ ] 1.1 `tag-group.machine.ts`: event union (collection events + `FOCUS`/`BLUR`/`ACTIVATE`/`REMOVE`), controllable `value` with set equality and the public shapes, bound props `selectionMode`/`disabled`/`removable`, `pendingRemoval` context (design §1)
- [ ] 1.2 Actions `activate` (link → action → selection → keyboard removal), `requestRemoval` (by key, selection minus disabled, deselect, `onRemove`), `announceRemoved` after `repairCollection`; `highlightInitial`
- [ ] 1.3 `node` tests for every spec scenario that needs no DOM (removal sets, disabled exclusion, refused removal, precedence, announcements with a recording announcer, repair over disabled runs)

## 2. Connect and messages

- [ ] 2.1 `tag-group.connect.ts`: role by interactivity and emptiness, names, `aria-selected`/`aria-multiselectable`, hint `aria-describedby` gated by modality and touch, TagRemove props, keymap, `data-*` per spec, `data-variant`/`data-size` pass-through
- [ ] 2.2 `tag-group.messages.ts`: `removeLabel`, `removeHint`, `removedAnnouncement`, `removedCountAnnouncement` (plural)
- [ ] 2.3 Unit tests for every attribute in the spec (interactive, empty, display-only, selectable, link, disabled)

## 3. React parts (`packages/react/src/tag-group`)

- [ ] 3.1 Root, Label, Description, List, Tag (row + internal cell), TagText (anchor with `href`), TagRemove, Empty; `render` on each
- [ ] 3.2 Dev warnings: unnamed interactive List, Tag Group inside an option/menuitem, TagRemove outside a Tag, Empty outside List
- [ ] 3.3 React tests: Strict Mode, SSR + hydrate (tab stop on the selected or first tag), static vs data tags, consumer `onRemove` that removes and one that refuses

## 4. Contract and driver

- [ ] 4.1 `tag-group.contract.ts` per design §5 (fragment, traits, `removalAnnouncement`, `{ skip }`, prop steps)
- [ ] 4.2 `getTagGroup` in `@rind-ui/testing`; driver tests in browser mode, jsdom and through Playwright against the site examples harness

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; issue-citing scenarios reproduce the issue first (adobe/react-spectrum#9471, #4224, #6616, #7483, #9822, #4278, #3070, #8354, #3074, #9532, #7310, #10720, #9205, #8151, #9507, #4197, #6962, #8740; ariakit/ariakit#6330, #6311, #7160; unovue/reka-ui#2785; chakra-ui/zag#1911)
- [ ] 5.2 `testMachine` over the props classes of the spec, all modalities incl. `virtual`, RTL run, axe per state (including the empty `group` state)
- [ ] 5.3 Virtual screen reader reading-order test (group name, row names without "Remove", hint in keyboard modality, selection state, removal announcement)

## 6. Theme (`packages/theme/src/tag-group.css`)

- [ ] 6.1 Tier-3 `--rind-tag-group-*` tokens (design §6) with semantic fallbacks, `@layer rind.components`, `:where()` selectors; `status` family `data-variant` (solid, soft, outline) and `data-size` (sm, md, lg); `data-tone="danger"`; states via `data-hover`/`data-selected`/`data-disabled`/`data-focus-visible`; ellipsis; ≥ 24px targets with `--rind-hit-area` on TagRemove; never `display: contents` on the List
- [ ] 6.2 Forced colors: outline focus ring, selected with `SelectedItem`/`Highlight` plus a border cue; Playwright forced-colors captures

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/tag-group.tsx, state examples for every contract state): Display-only, removable, filter chips (multiple selection), single selection, selectable + removable, action tags opening a dialog, link tags, disabled tags, empty state, RTL, long text, sizes and variants
- [ ] 7.2 Driver example (docs testing example); all examples render with the theme stylesheet and pass axe (including colour contrast)

## 8. Docs and closing

- [ ] 8.1 Docs page (generated API facts + guide: Tag Group vs Combobox/Tags Input chips, removal and the consumer's `onRemove`, why the remove button is not a Tab stop, selection for filters, links and actions, testing with `getTagGroup`)
- [ ] 8.2 Manual tier-1 pass (VO + Safari macOS/iOS, VO + Chrome, NVDA + Firefox/Chrome, JAWS, TalkBack): removal by Delete, by virtual-cursor button, hint, announcement; record in "Tested with"
- [ ] 8.3 Set Tag Group to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from coordinator, 2026-10-14)

- [ ] A.1 `component-contract` delta ("Location By Accessible Name", `specs/component-contract/spec.md`): `locate` accepts a set of roles in `@rind-ui/testing` (match any role with the exact name; uniqueness across all of them); Tag Group contract locates by `grid | group | list` + exact name; test for "Locating by a set of roles" in browser mode and jsdom
