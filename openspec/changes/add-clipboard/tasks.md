## 0. Research and spec

- [x] 0.1 Research note `docs/research/clipboard.md` (Zag / Ark, Mantine, Chakra, React Aria, VueUse, copy-to-clipboard, clipboard.js; bug history; a11y)
- [x] 0.2 This change: proposal, design, `specs/clipboard/spec.md`; `openspec validate add-clipboard --strict`

## 1. Machine

- [ ] 1.1 `components/clipboard/copy.ts`: `writeClipboard` effect and `announceCopy` extracted from Code Block (design §3); Code Block imports them, its tests unchanged
- [ ] 1.2 `clipboard.machine.ts`: states `idle` / `copying` / `copied` / `error`, events per design §2, guards `enabled` and `whole`, `feedback` delay, `onCopy` with `source`
- [ ] 1.3 Node tests with `fakeClipboard` and a virtual scheduler: success, reject, absent, latency (`copying` observed), restart, ignored press while copying, unmount drops the result, disabled, whole vs partial input copy, synchronous `writeText` call

## 2. Connect

- [ ] 2.1 `clipboard.connect.ts`: parts and attributes per design §4 (trigger name with the Label, input selection and `copy` handler, `data-state` on every part)
- [ ] 2.2 `clipboard.messages.ts` (`copy`, `copied`, `copyFailed`)
- [ ] 2.3 Connect and meta tests (`clipboard.meta.ts` checked against the code)

## 3. React parts

- [ ] 3.1 `Clipboard.Root`, `Label`, `Control`, `Input`, `Trigger`, `Indicator` (`copied` / `failed` props), `ValueText`; part registry; render state `{ copyState, value }`; copy on `click`

## 4. Contract and driver

- [ ] 4.1 `Part.copySelection()` in `contract/env.ts`, the DOM adapter (cancelable `copy` event) and the Playwright adapter (`ControlOrMeta+C`)
- [ ] 4.2 `clipboard.contract.ts`: anatomy, locate, actions, queries, invariants, event mapping (design §6)
- [ ] 4.3 `getClipboard` exported from `@rind-ui/testing`

## 5. Tests

- [ ] 5.1 DOM tests (jsdom and browser): anatomy and IDREFs with each optional part missing, form not submitted, trigger name, announcements, input selection (Tab and first click), partial vs whole copy, disabled, localised messages, SSR + hydration
- [ ] 5.2 Browser: Chromium reads back the real clipboard after a press; WebKit and Firefox resolve a real `writeText` from a trusted click (skip with a recorded reason if the automation build denies clipboard access)
- [ ] 5.3 Model-based tests over the configurations of design §7 in Chromium, Firefox and WebKit, and in jsdom

## 6. Theme

- [ ] 6.1 `packages/theme/src/clipboard.css` per design §8, imported from `index.css`; `clipboard` in the `field` family in `families.ts`
- [ ] 6.2 Browser test: icon per state, trigger ≥ 24 px, forced colors, reduced motion

## 7. Site and docs

- [ ] 7.1 Site example `apps/site/examples/clipboard.tsx` (copy button, field with label, value text, failing clipboard, disabled, localised) and skin `apps/site/skins/clipboard.css`, registered; state examples `idle`, `copied`, `error`
- [ ] 7.2 Docs page `docs/components/clipboard.md` with "When to use" and the label-in-name note for text triggers; `docs/components.md` status
- [ ] 7.3 Changeset

## 8. Proof

- [ ] 8.1 `pnpm lint`, `pnpm typecheck`, changed tests (node, jsdom, browser in three engines), Code Block's tests unchanged, site audit 0 findings
