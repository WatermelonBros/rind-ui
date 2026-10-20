## 0. Research and spec

- [x] 0.1 Research note `docs/research/kbd.md`
- [x] 0.2 This change; `openspec validate add-kbd --strict`

## 1. Core

- [x] 1.1 `kbd.keys.ts` (`parseKeys`, `resolveKey`, `keyShortcuts`) with Node tests
- [x] 1.2 Connect, messages, meta, contract and tests

## 2. React, driver, tests

- [x] 2.1 Parts (platform through the environment, hydration-safe) and `getKbd`
- [x] 2.2 DOM tests

## 3. Theme, site, docs

- [x] 3.1 `kbd.css` and browser test
- [x] 3.2 Site examples checked by screenshot in the base theme and a skin; skin; docs page; `docs/components.md` row; changeset

## 4. Proof

- [x] 4.1 `pnpm verify`, browser tests, axe, site audit 0 findings
