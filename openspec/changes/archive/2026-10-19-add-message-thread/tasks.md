## 0. Research and spec

- [x] 0.1 Research note `docs/research/message-thread.md`
- [x] 0.2 This change; `openspec validate add-message-thread --strict`

## 1. Machine and DOM

- [x] 1.1 `message-thread.machine.ts` (design §2) and Node tests
- [x] 1.2 `core/dom/stick-to-bottom.ts` (design §3) and browser tests (programmatic vs user scroll, wheel, selection, resize, prepend)

## 2. Connect

- [x] 2.1 Connect, messages, meta (design §4) and tests; feed keyboard rules (§5)

## 3. React parts

- [x] 3.1 `MessageThread.Root`, `Viewport`, `Message`, `JumpToLatest`

## 4. Contract and driver

- [x] 4.1 `message-thread.contract.ts` with the invariants; `getMessageThread`

## 5. Tests

- [x] 5.1 DOM tests (browser; jsdom subset): follow, escape, re-attach, unread, jump focus, top anchor, Page Down / Up, Control+End, prepend, reduced motion
- [x] 5.2 Model-based tests

## 6. Theme

- [x] 6.1 `packages/theme/src/message-thread.css`; browser test

## 7. Site and docs

- [x] 7.1 Site examples (a chat with Streaming Message, top anchor, load older) and skin
- [x] 7.2 Docs page (with a virtualizer recipe); `docs/components.md` status
- [x] 7.3 Changeset

## 8. Proof

- [x] 8.1 `pnpm verify`, browser tests, site audit 0 findings
