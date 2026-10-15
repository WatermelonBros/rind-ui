# rind-ui — agent guide

Headless component library: behaviour, accessibility and state, styled by the
consumer through `data-*` attributes. Written from scratch; the goal is a superset
of every headless library ([docs/components.md](docs/components.md)), testable by
design, and easy for LLMs to use.

Read before changing anything:

- [docs/decisions/](docs/decisions/) — *why* (vision, architecture, testing, theme, LLM docs, fx).
- [openspec/](openspec/) — *what* each capability SHALL do. Behaviour changes go
  through an OpenSpec change (`/opsx:propose`), never straight into code.
- [docs/research/](docs/research/) — **no spec before research.** Before writing
  the OpenSpec change for a component, its research note must exist and be done:
  how every library that ships it implemented it (read their source), the bugs
  reported and fixed over its history (issue trackers, open and closed), and the
  accessibility notes for its pattern. The cross-cutting accessibility notes
  (`accessibility.md`, `assistive-tech-and-a11y-testing.md`, `native-platform.md`)
  apply to every component and are read first.

## Commands

```sh
pnpm install
pnpm build        # turbo: all packages + storybook
pnpm typecheck    # turbo: tsc in every package
pnpm test         # turbo: vitest
pnpm lint         # biome check (CI fails on any diagnostic)
pnpm format       # biome check --write
pnpm storybook    # playground on :6006
pnpm changeset    # describe a release-worthy change
```

Turborepo may differ from what you remember: read the installed version's docs
(see the block in [AGENTS.md](AGENTS.md)) before changing `turbo.json`.

## Layout

```
packages/core      @rind-ui/core     machines, connect, dom/, collection/, contracts, ai/ — no framework
packages/react     @rind-ui/react    React parts + normalizeProps
packages/testing   @rind-ui/testing  drivers, DOM/Playwright adapters, model-based tests, env setup
packages/theme     @rind-ui/theme    optional CSS on data-* attributes
apps/storybook                       playground and docs examples
```

## The four layers — one direction only

```
machine ──► connect ──► parts (react/…)        contract ──► testing adapters ──► drivers
```

1. **machine** (`*.machine.ts`): pure TypeScript. No DOM, no framework, no
   timers or globals except through injected effects. Declared statically.
2. **connect** (`*.connect.ts`): state → framework-neutral props per part. Owns
   every `aria-*` and `data-*` attribute. DOM access only through `core/dom`.
3. **parts** (`packages/<framework>`): thin. Wiring, refs, `normalizeProps` —
   **no behaviour**. If a part needs logic, it belongs in the machine.
4. **contract** (`*.contract.ts`): actions and queries against the environment
   abstraction. Locate by role/accessible name first, `data-scope`/`data-part`
   second. Never by class or DOM position.

A lower layer never imports a higher one. `core` never imports a framework.

## Design principles

Apply SOLID with intent, not ceremony:

- **Single responsibility** — one machine per component, one concern per module
  in `dom/` (focus trap, dismiss, scroll lock are separate and composable).
- **Open/closed** — extend through composition (parts, slots, injected effects,
  event callbacks), not flags. A new behaviour is a new state or event, not a
  boolean prop that forks code paths.
- **Liskov** — every part accepts and forwards the props of the element it renders;
  substituting the element (`asChild` / `render`) must not change behaviour.
- **Interface segregation** — small, focused types: a component asks for the
  capabilities it uses (`Focusable`, `Dismissable`), not a god-object context.
- **Dependency inversion** — machines depend on abstractions (`Environment`,
  `Scheduler`, `Announcer`) injected at creation, which is also what makes them
  testable without a DOM.

And:

- **Generic where it is real.** Shared infrastructure (collection, dismiss,
  presence, typeahead) is written once and reused by every component that needs
  it. Do not generalise from one case; generalise when the second component needs
  it.
- **Accessibility is behaviour.** Roles, keyboard support and announcements follow
  the WAI-ARIA APG pattern and are specified in OpenSpec like any other behaviour.
- **Every component ships**: machine, connect, parts, contract, driver, tests,
  theme stylesheet, stories (rendering the themed component), docs page — in that
  order: the theme comes before the stories. Missing one = not done.

## TypeScript

Strictest settings are on (see `tsconfig.base.json`: `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`,
`verbatimModuleSyntax`). Use the type system to make wrong code fail to compile —
advanced types are welcome when they earn that:

- **Inference from definitions.** Machine state names, event names, context and
  contract actions are inferred from the definition object (`const` type
  parameters, `satisfies`). A typo in a target or an event name is a compile error.
- **Discriminated unions** for events and states; exhaustive handling via a
  `never` check. No string-typed `event.type` anywhere.
- **Template literal types** for parts and data attributes
  (`` `data-${string}` ``, `` `${Scope}:${Part}` ``).
- **`NoInfer`**, conditional and mapped types, variadic tuples — where they keep
  the public API simple and the inference right.
- **Branded types** for values that must not mix (ids, collection keys).
- **No `any`.** `unknown` + narrowing. Type assertions need a comment saying why
  they are sound.
- Public types are part of the API: name them, export them, document them.
  Inference must not leak private implementation types into `.d.mts`.

Complexity budget: a clever type must make the *consumer's* code simpler or safer.
If it only makes the library's code shorter, write the simpler type.

## Code style

- Biome formats and lints; do not fight it. Double quotes, no semicolons, 100 cols.
- English for code, comments, docs and specs (the project is public). Comments say
  *why*, not what.
- Small files, named exports, no default exports in packages.
- No new runtime dependency without a decision record. Allowed today:
  `@floating-ui/dom`, `@internationalized/date`, `@internationalized/number`
  (decision 0009).

## Tests

- Test through the component's own **driver** — we are its first user.
- Primary: Vitest browser mode (Playwright). A jsdom suite proves
  `@rind-ui/testing/setup` works for consumers.
- Model-based tests from the machine graph for every component with a machine.
- Every story passes axe (`a11y.test: "error"`).

## Docs for humans and LLMs

API facts (props, parts, `data-*`, states, contract actions) are **generated** from
source, never hand-copied, so `llms.txt` and the per-component markdown cannot
drift. When adding a component, make sure its docs page and stories exist; see
[docs/decisions/0005-llm-knowledge.md](docs/decisions/0005-llm-knowledge.md).

## Review rules

- Every review finding has a severity: **critical** (breaks behaviour, data,
  security or accessibility), **error** (violates a SHALL/scenario of the spec, or a
  real bug) or **warning** (weak test, quality, edge case, polish).
- Only **critical** and **error** findings become Reado tasks to fix. **Warnings** go
  to [docs/review-backlog.md](docs/review-backlog.md) and are picked up later.
- **One review round per change, by one reviewer, scoped to the change's own diff**
  (the files the change created or modified, plus its OpenSpec change) — never the
  whole repository. The implementer's hand-off lists every file it touched. After the
  fixes, the reviewer only checks the gate is green and the review tasks are closed,
  then approves; whatever is left goes to the backlog.
- Feedback from the user (manual testing, product decisions) is outside this limit:
  it becomes new tasks or a new change.

## Closing work (keep the board clean)

Two sessions work on this repo: one writes specs and reviews, one implements.

- **Reado review tasks**: resolve each with a command that proves the fix, so a
  passing check closes it automatically:
  `reado-cli task done <id> --verify "<targeted test command>"` (binary:
  `/Applications/Reado.app/Contents/MacOS/reado-cli`, `--root` this repo). Use
  `--capture` alone only when no automated check is possible; the reviewer then
  verifies and closes it. A task is never left open or resolved-unverified once the
  reviewer has approved the change.
- **OpenSpec changes**: when a change is implemented AND the reviewer has approved
  it, archive it (`/opsx:archive` or `openspec archive <name>`), so its specs move to
  `openspec/specs/` and `openspec/changes/` only holds work still to do. Update the
  component's Status in `docs/components.md` to `done`.
- Tick `tasks.md` checkboxes as you go; never archive a change with unticked tasks.

## Scope guard

`fx` (visual effects) is secondary — see
[docs/decisions/0006-fx.md](docs/decisions/0006-fx.md). Do not start fx work unless
asked.
