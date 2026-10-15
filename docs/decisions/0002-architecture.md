# 0002 — Architecture

Status: accepted · 2026-10-14

## Packages

```
packages/
├─ core/      @rind-ui/core     machines, connect, dom/, collection/, contracts — zero framework
├─ react/     @rind-ui/react    React parts + normalizeProps for React
├─ testing/   @rind-ui/testing  drivers, DOM/Playwright adapters, model-based tests, env setup
└─ theme/     @rind-ui/theme    optional CSS theme on data-* attributes (see 0004)
apps/
└─ storybook/                   component playground; future docs site examples
```

`testing` is its own package because it is a devDependency: nothing in it may end
up in a production bundle. Vue, Solid and Svelte adapters (`packages/vue`, …) are
added when there is demand; the core is designed for them from day one because
retrofitting framework independence onto 50 components is a rewrite.

`fx` (visual effects) is a separate, secondary project — see [0006-fx.md](0006-fx.md).

## The four layers of a component

Every component — Dialog and Prompt Input alike — has the same anatomy:

```
core/src/components/select/
├─ select.machine.ts    ① state machine — pure TS, no DOM
├─ select.connect.ts    ② state → props per part (aria-*, data-*, handlers)
└─ select.contract.ts   ④ actions and queries, machine-readable
react/src/select/
└─ select.tsx           ③ React parts: Root, Trigger, Content, Item…
```

### ① Machine

States, events, transitions, guards and effects, declared **statically**. Static
declaration is what lets us walk the machine as a graph — for generated tests
and for devtools — instead of reverse-engineering behaviour from code.

```ts
export const selectMachine = machine({
  initial: "closed",
  states: {
    closed: { on: { OPEN: "open", TYPEAHEAD: { actions: "highlightMatch" } } },
    open: { on: { CLOSE: "closed", SELECT: { target: "closed", actions: "setValue" } } },
  },
})
```

We write our own small runtime (as Zag did) rather than use XState: bundle size is
paid per component, and we need only a subset. The runtime's types infer state
names, event names and context from the definition — a typo in a target is a
compile error.

### ② Connect

Maps machine state to props for each part, in a framework-neutral shape. Each
adapter converts them with its own `normalizeProps` (`onClick` vs `onclick`,
`className` vs `class`, event typing).

```ts
trigger: {
  "aria-expanded": state.matches("open"),
  "aria-haspopup": "listbox",
  "data-scope": "select",
  "data-part": "trigger",
  "data-state": state.value,
  onClick: () => send("OPEN"),
}
```

`data-scope` + `data-part` + `data-state` (and `data-highlighted`,
`data-disabled`, …) are the **styling contract** and the **testing contract** at
once. Positioning is exposed as CSS custom properties.

### ③ Parts (per framework)

Compound components, as in Ark and Radix, with element substitution (`asChild` or
a `render` prop — decided in the first component's research note).

```tsx
<Select.Root value={v} onValueChange={setV}>
  <Select.Trigger />
  <Select.Content>{items.map((i) => <Select.Item key={i} value={i} />)}</Select.Content>
</Select.Root>
```

### ④ Contract

What can be *done* to the component and what can be *read* from it, written
against a minimal environment abstraction (`part()`, `click()`, `type()`,
`attr()`, `text()`). The contract does not know where it runs; `@rind-ui/testing`
supplies the environment. See [0003-testing.md](0003-testing.md).

```ts
export const selectContract = contract("select", {
  actions: {
    open: ({ part }) => part("trigger").click(),
    choose: ({ part }, label: string) => part("item", { name: label }).click(),
  },
  queries: {
    isOpen: ({ part }) => part("trigger").attr("aria-expanded") === "true",
    value: ({ part }) => part("value-text").text(),
  },
})
```

## Shared infrastructure in core

```
core/src/
├─ machine/      runtime
├─ dom/          focus trap, dismiss (Esc, outside click), scroll lock, presence, portal, live region
├─ collection/   lists and trees: selection, keyboard navigation, typeahead, virtualization
├─ components/   one folder per component (machine, connect, contract)
└─ ai/           prompt-input/, message-thread/, streaming-message/, tool-approval/, agent-presence/
```

The `ai/` primitives follow exactly the same four-layer rule.

## Dependencies we do not rewrite

- **@floating-ui/dom** — positioning (collision, flip, shift, virtual anchors).
- **@internationalized/date** — calendars, time zones, locales (React Aria's).
- **@internationalized/number** — locale-aware number parsing and formatting
  (decision [0009](0009-internationalized-number.md)).

Everything else is ours. A new runtime dependency needs a decision record.

## Tooling

| Concern | Choice | Why |
|---|---|---|
| Package manager | pnpm 11 workspaces | Strict, fast; same as Reado |
| Task runner | Turborepo | Cached `build`/`typecheck`/`test` across packages |
| Language | TypeScript 7 | Native compiler; strictest settings (see tsconfig.base.json) |
| Library build | tsdown (+ publint) | Rolldown-based, emits ESM + `.d.mts`, validates `exports` |
| Lint/format | Biome | One tool, fast; same as Reado |
| Tests | Vitest (browser mode via Playwright) + a jsdom suite | Real browser first; jsdom proves `@rind-ui/testing/setup` works |
| Playground | Storybook 10 | See [0004](0004-theme-and-storybook.md) |
| Releases | Changesets | Independent versions per package |

**Source condition.** Each package exports `"@rind-ui/source": "./src/index.ts"`
ahead of `dist`. `tsconfig` (`customConditions`) and Storybook's Vite config
resolve it, so typechecking and the playground never wait for a build.

**TypeScript 7 caveat.** tsdown warns that TS 7's programmatic API is still
experimental. If declaration output misbehaves, pin TypeScript 6 for `build`
only; the compiler for typechecking stays 7.

## Build order

1. Machine runtime, `dom/`, contract and both adapters — proven on **Dialog**
   (focus trap, presence, dismiss and portal exercise all of it).
2. What Reado uses: Select, Menu / Context Menu, Drawer, Tooltip, Segmented
   Control, Checkbox, QR Code. Then migrate Reado.
3. AI-UI primitives: Prompt Input, Message Thread, Streaming Message.
4. Waves 1 → 3 of [components.md](../components.md) until parity and beyond.
