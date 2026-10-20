## 0. Research and spec

- [x] 0.1 Research note `docs/research/tree-view-dnd.md`
- [x] 0.2 This change; `openspec validate add-tree-view-dnd --strict`

## 1. Core

- [x] 1.1 `tree-move.ts` (`moveTarget`, `pointerTarget`, `moveNode`) with Node tests
- [x] 1.2 Machine events, announcements, connect (indicator, data attributes), messages, meta

## 2. React, contract

- [x] 2.1 Keys, pointer drag, auto-expand, DropIndicator; contract actions and query
- [x] 2.2 DOM tests (jsdom and browsers)

## 3. Theme, site, docs

- [x] 3.1 Theme rules for dragging, drop target and indicator; browser test
- [x] 3.2 Site example (a movable file tree) checked in the base theme and a skin; docs section; roadmap row; changeset

## 4. Proof

- [x] 4.1 `pnpm verify`, browser tests, axe, site audit 0 findings
