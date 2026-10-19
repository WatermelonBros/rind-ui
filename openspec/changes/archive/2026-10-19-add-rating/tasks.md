## 0. Research and spec

- [x] 0.1 Research note `docs/research/rating.md` (Zag / Ark, Reka, Bits UI, Kobalte, MUI, APG, React Aria; bug history; a11y)
- [x] 0.2 This change: proposal, design, `specs/rating/spec.md`; `openspec validate add-rating`

## 1. Machine

- [x] 1.1 `rating.machine.ts`: grid (`ratingRange`, `normalizeRating`, `ratingAt`, `ratingKeyTarget`), states `idle` / `previewing`, events per design §2, one write path with controlled `pending`, AT adoption with floor refusal, reset to the current default
- [x] 1.2 Node tests: grid, half and clear presses, keys and floors, preview without value change, read-only / disabled, controlled refusal and arrival, AT adjustment, reset

## 2. Connect

- [x] 2.1 `rating.connect.ts`: parts and attributes per design §3, `ratingKeyEvent` (RTL, modifiers), `ratingFraction` (RTL, zero-size box), form value `""` while unrated
- [x] 2.2 `rating.messages.ts`: `valueText` through `format.number`
- [x] 2.3 Connect and meta tests (`rating.meta.ts` checked against the code)

## 3. React parts

- [x] 3.1 `Rating.Root`, `Label`, `Control`, `Item`; Field and Fieldset binding; both inputs through `hidden-form-input`; press on release, preview not from touch, bare click as a whole star

## 4. Contract and driver

- [x] 4.1 `rating.contract.ts`: anatomy, locate, actions, queries, traits, invariants, event mapping
- [x] 4.2 `getRating` exported from `@rind-ui/testing`

## 5. Tests

- [x] 5.1 DOM tests (jsdom and browser): anatomy, keyboard, RTL, read-only / disabled, clear, half stars and hover (browser), AT adjustment, form submit / reset / required / fieldset / Field, controlled, SSR + hydration
- [x] 5.2 Model-based tests over the configurations of design §6 in Chromium, Firefox and WebKit, keyboard in jsdom

## 6. Theme

- [x] 6.1 `packages/theme/src/rating.css` per design §7, imported from `index.css`, `rating` in the `range` family
- [x] 6.2 Browser test: sizes ≥ 24 px, outline and fill by state, RTL half, preview tone, forced colors

## 7. Site and docs

- [x] 7.1 Site example `apps/site/examples/rating.tsx` (basic, half stars, clearable, ten stars, RTL, read-only, disabled, controlled, in a form) and skin `apps/site/skins/rating.css`, registered; state example `idle` (`previewing` is transient)
- [x] 7.2 Docs page `docs/components/rating.md` with "When to use"; `docs/components.md` status
- [x] 7.3 Changeset

## 8. Proof

- [x] 8.1 `pnpm lint`, `pnpm typecheck`, changed tests (node, jsdom, browser in three engines), site audit 0 findings
