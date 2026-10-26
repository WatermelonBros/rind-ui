## 0. Research and spec

- [x] 0.1 Research note `docs/research/json-tree-view.md`
- [x] 0.2 This change: proposal, design, `specs/json-tree-view/spec.md`; `openspec validate add-json-tree-view --strict`

## 1. Core

- [x] 1.1 `json-tree/`: pointers, types, lazy nodes, grouping, cycles, item text, spoken summary
- [x] 1.2 `jsonStringify` (BigInt, Map/Set, cycle error); copy wiring on the Clipboard capability
- [x] 1.3 `expandAll` bound; messages, meta, contract (Tree View's plus JSON queries)
- [x] 1.4 Node tests

## 2. Framework parts

- [x] 2.1 React
- [x] 2.2 Vue
- [x] 2.3 Svelte
- [x] 2.4 Solid
- [x] 2.5 Angular

## 3. Driver and tests

- [x] 3.1 `getJsonTreeView`; DOM tests (jsdom and three engines); model-based through Tree View's

## 4. Theme

- [x] 4.1 `json-tree-view.css`; `families.ts`; browser test

## 5. Site and docs

- [x] 5.1 Site example and skin; docs page (BigInt recipe); `docs/components.md`; home
- [x] 5.2 Changeset

## 6. Proof

- [x] 6.1 `pnpm lint`, `pnpm typecheck`, tests of every touched package, site audit
