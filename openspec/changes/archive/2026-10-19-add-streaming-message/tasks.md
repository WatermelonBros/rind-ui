## 0. Research and spec

- [x] 0.1 Research note `docs/research/streaming-message.md`
- [x] 0.2 This change: proposal, design, `specs/streaming-message/spec.md`; `openspec validate add-streaming-message --strict`

## 1. Machine

- [x] 1.1 `streaming-message.machine.ts`: states and `SYNC` precedence (design §2), mount without reveal, rewrite reset, `TICK` with `after`, `revealStep`, motion; announcements (design §3)
- [x] 1.2 Node tests: precedence, settling, cancel and error show all, mount silent, rewrite, revealStep drain, reduced motion, every announce mode

## 2. Connect

- [x] 2.1 `streaming-message.connect.ts` and `.messages.ts`; `.meta.ts`
- [x] 2.2 Connect and meta tests

## 3. React parts

- [x] 3.1 `StreamingMessage.Root`, `Content` (node or function children), `Caret`

## 4. Contract and driver

- [x] 4.1 `streaming-message.contract.ts` with the invariants; `getStreamingMessage`

## 5. Tests

- [x] 5.1 DOM tests (jsdom and browser): renderer, busy and caret, server render, virtual-clock reveal, announcements, reduced motion
- [x] 5.2 Model-based tests

## 6. Theme

- [x] 6.1 `packages/theme/src/streaming-message.css`, `decoration` family; browser test

## 7. Site and docs

- [x] 7.1 Site examples (simulated stream, markdown renderer, cancel, error, announce modes) and skin
- [x] 7.2 Docs page with "When to use" and a markdown-renderer recipe; `docs/components.md` status
- [x] 7.3 Changeset

## 8. Proof

- [x] 8.1 `pnpm verify`, browser tests, site audit 0 findings
