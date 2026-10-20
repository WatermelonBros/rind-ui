## 0. Research and spec

- [x] 0.1 Research note `docs/research/table-of-contents.md`
- [x] 0.2 This change; `openspec validate add-table-of-contents --strict`

## 1. Core

- [x] 1.1 `core/dom/reading-position.ts` (`collectHeadings`, `measureReading`, `readingPosition`) with browser tests (bottom of page, container, offset, hidden targets)
- [x] 1.2 Machine (design §2) and Node tests on a manual clock
- [x] 1.3 Connect, messages, meta and tests

## 2. React, contract, driver

- [x] 2.1 Parts; link activation and focus; list auto-scroll
- [x] 2.2 Contract and `getTableOfContents`

## 3. Tests

- [x] 3.1 DOM tests (browser) and model tests

## 4. Theme, site, docs

- [x] 4.1 `table-of-contents.css` and browser test
- [x] 4.2 Site examples (an article, a scroll container, a sticky header) checked by screenshot in the base theme and a skin; the site's "On this page" rebuilt on the component; skin; docs page; `docs/components.md` row; changeset

## 5. Proof

- [x] 5.1 `pnpm verify`, browser tests, site audit 0 findings
