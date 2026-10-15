# 0003 — Testing

Status: accepted · 2026-10-14

## The problem

Testing apps built on Ark UI is hard, and it was felt first-hand in Reado:

- jsdom lacks what the machines rely on: `ResizeObserver`, `scrollIntoView`,
  `Element.getAnimations`, real pointer events, layout.
- Portals, presence (exit animations) and async focus moves make naive queries
  flaky.
- Every app rewrites the same "open the select, pick an option" helpers, coupled to
  the library's internal DOM.

## The answer: one contract, two environments

Each component's **contract** (layer ④, see [0002](0002-architecture.md#-contract))
declares its actions and queries. `@rind-ui/testing` turns contracts into
**drivers** and runs them in either environment through an adapter:

```
testing/src/
├─ setup/        jsdom/happy-dom polyfills: ResizeObserver, scrollIntoView, getAnimations, pointer events
├─ adapters/
│  ├─ dom.ts         part() → Testing Library queries, click() → user-event
│  └─ playwright.ts  part() → Playwright locators, click() → locator.click()
├─ drivers.ts    getSelect(), getDialog()… derived from contracts
├─ ai.ts         mockStream() and helpers for streamed responses
└─ model.ts      tests generated from machine graphs
```

```ts
// Vitest + Testing Library
const select = getSelect(screen, { name: "Country" })
await select.open()
await select.choose("Italy")
expect(await select.value()).toBe("Italy")

// Playwright — same API, same contract
const select = getSelect(page, { name: "Country" })
```

Drivers locate parts by accessible role/name first and `data-scope`/`data-part`
second, so they keep working when the consumer restyles or wraps the component —
and fail when accessibility breaks, which is the point.

## Model-based tests

Because machines are static graphs (see [0002](0002-architecture.md#-machine)),
`model.ts` walks every path, drives each step through the contract, and checks
invariants after each one:

- `aria-expanded` matches the `open` state;
- closing returns focus to the trigger;
- Escape always closes the topmost layer;
- exactly one live-region announcement per completed streamed message.

We use these for rind-ui itself, and **export them**, so a consumer can prove that
*their* styled wrapper did not break the component:

```ts
testMachine(selectContract, () => render(<MySelect />))
```

No headless library offers this today.

## Streaming (AI-UI primitives)

```ts
const thread = getMessageThread(screen)
await thread.stream(mockStream(["Hel", "lo", " there"]))
expect(thread.lastMessage).toHaveText("Hello there")
expect(thread.announcements).toEqual(["Hello there"]) // one announcement, not three
```

## How rind-ui tests itself

- Vitest **browser mode** (Playwright provider) is the primary environment —
  real layout, focus and pointer events.
- A smaller **jsdom** suite runs the same driver tests with
  `@rind-ui/testing/setup`, to prove the setup actually works for consumers.
- Our own tests use our own drivers. We are the first users.
- Storybook stories double as test fixtures (Storybook's Vitest addon), and every
  story runs axe (`a11y.test: "error"`).

## Prior art to study before building

- **@react-aria/test-utils** — React Aria's official test utilities, with guides
  per component (Select, ComboBox, Table, Tree, …). Closest existing idea.
- **ariakit-test** — Ariakit's testing package.
- Ark UI / Zag's own test suites — what they polyfill and why.

The research note for `@rind-ui/testing` must explain what each does well, where
it stops, and what we do differently.
