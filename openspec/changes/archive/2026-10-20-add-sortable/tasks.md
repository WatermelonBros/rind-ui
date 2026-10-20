## 0. Research and spec

- [x] 0.1 Research note `docs/research/sortable.md`
- [x] 0.2 This change; `openspec validate add-sortable --strict`

## 1. Core

- [x] 1.1 `reorder` and the machine (design §1, §2) with Node tests
- [x] 1.2 `core/dom/sortable-drag.ts` (threshold, long press, targets, auto-scroll)
- [x] 1.3 Connect, messages, meta, contract and tests

## 2. React, driver, tests

- [x] 2.1 Parts (registration of labels, keys, pointer wiring, source loss) and `getSortable`
- [x] 2.2 DOM tests (browser) and model tests

## 3. Theme, site, docs

- [x] 3.1 `sortable.css` and browser test
- [x] 3.2 Site examples (task list, reorderable tabs) checked by screenshot in the base theme and a skin; skin; docs page; `docs/components.md` row; changeset

## 4. Proof

- [x] 4.1 `pnpm verify`, browser tests, axe, site audit 0 findings
