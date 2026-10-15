# Machine runtime — research

Status: done · Infrastructure (build order step 1, proven on Dialog)

Paths below are relative to shallow clones of each upstream repository (read
2026-10-14): `zag/` = chakra-ui/zag, `ariakit/` = ariakit/ariakit, `react-spectrum/` =
adobe/react-spectrum, `base-ui/` = mui/base-ui, `radix/` = radix-ui/primitives,
`headlessui/` = tailwindlabs/headlessui, `bits-ui/`, `kobalte/`. Issue numbers are
`chakra-ui/zag#N` unless marked `ark#N` (chakra-ui/ark).

## 1. Summary

- **Zag's definitions are only half static.** The `states` / `on` tree is data and can be
  walked. But guards and actions can be inline functions (`GuardFn`, `ActionsOrFn`,
  `choose`), and `watch` is plain code that turns prop changes into events. The
  controlled/uncontrolled behaviour is rebuilt by hand in 12 of 52 machines, each time
  with a `CONTROLLED.*` event, an `isOpenControlled` guard and a `track()` call. A graph
  extracted from Zag misses exactly the edges that cause the most bugs.
- **Zag types come from a hand-written `Schema` interface**, not from the definition
  (`zag/packages/machines/dialog/src/dialog.types.ts`). It lists every state, event,
  action, guard and effect name. Strings in the definition are checked against it, so
  each new action means editing two places. We infer the names from the definition and
  from the implementation keys instead.
- **Zag ships six interpreters**: `frameworks/{react,preact,vue,solid,svelte,vanilla}/src/machine.ts`,
  317–397 lines each, each reimplementing transitions, effects and bindables. Bugs are
  then fixed one framework at a time (#3018 vanilla, #3138 / #3365 / #3442 / #2942
  Svelte). rind-ui has **one interpreter in core**. Adapters only call
  `subscribe` / `getSnapshot` / `send` / `setProps`.
- **The non-machine libraries are converging on an external store anyway.** Base UI went
  from `useControlled` to a `ReactStore` class with selectors. Headless UI has a
  framework-free `Machine` class (a reducer with selector subscriptions). Ariakit has
  `createStore`. Even Radix and Bits UI each keep a 20-line typed `useStateMachine`
  (used by Presence and ScrollArea). The machine idea itself is sound; Zag's
  hook-shaped execution of it is where the bugs come from.
- **Proposed API**, modelled on XState v5:
  `setup({ types, guards, actions, effects }).machine(def)`. Names are inferred from
  implementation keys (`const` type parameters). State targets are checked through an
  F-bounded `D extends MachineDef<D>`. The definition holds no functions except
  `context` and `computed`. Guards combine as data (`{ and: [...] }`).
- **Controlled values are built into the runtime.** A `controllable("open")` declaration
  infers `defaultOpen` and `onOpenChange` through template literal types. It can be
  bound to states, and it is resolved from props at read time, so there is no effect
  lag and nothing to sync. Prop-driven state changes become declared `$sync` edges.
- **`send` is synchronous and run-to-completion** (no `queueMicrotask`, which caused
  #3324; no `flushSync`, which caused #3005). Each completed step produces one immutable
  snapshot, which React reads through `useSyncExternalStore`.
- **The machine is flat**: tags, delayed transitions (`after`) and composition between
  machines. No nested or parallel states in v1 (4 of 52 Zag machines nest, none run in
  parallel). The graph is one function (`toGraph`), and path generation is an in-house
  BFS, not `@xstate/graph`.

## 2. How each library models state

### Zag.js (Ark UI's engine)

Files read: `zag/packages/core/src/{create-machine,types,state,scope,memo,replace-tracker}.ts`,
`zag/packages/frameworks/react/src/{machine,bindable,track,refs,normalize-props}.ts`,
`zag/packages/frameworks/vanilla/src/machine.ts`, `zag/packages/store/src/{index,proxy}.ts`,
`zag/packages/machines/{dialog,select}/src/*.{machine,types,connect}.ts`.

**Definition.** `createMachine<Schema>(config)` (`core/src/create-machine.ts`) only
validates the state index and returns the config. Everything happens in the framework
interpreter. Shape (`core/src/types.ts`, `Machine<T>`):

- `props({ props, scope })`: applies defaults; this runs on every read in vanilla.
- `context({ prop, bindable, scope, getContext, … })` returns `{ key: bindable(() => ({ value, defaultValue, onChange, isEqual, hash, sync })) }`.
  In React, `bindable` *is* `useBindable`, a hook. So the context factory is a hook call
  inside the definition (`react/src/machine.ts:53`).
- `computed: { key: ({ context, prop, refs, computed }) => … }`: recomputed on every call
  (`react/src/machine.ts:160`). `memo.ts` exists but machines call it by hand.
- `refs()` holds mutable non-reactive values (for example the typeahead buffer).
- `initialState({ prop })` is a function.
- `watch({ track, action, prop, context })` is imperative code.
  `track([() => prop("open")], () => action(["toggleVisibility"]))` is a `useEffect` with
  computed deps (`react/src/track.ts`).
- `states`: keys can be nested (`initial` and `states` per node). Each node has `tags`,
  `entry`, `exit`, `effects`, and `on: { EVENT: Transition | Transition[] }`.
  `Transition = { target?, guard?, actions?, reenter? }`.
- `implementations: { guards, actions, effects }` are looked up by string at run time.
  A missing implementation only produces `warn(...)` (`react/src/machine.ts:196`).

**Typing.** `MachineSchema` (`types.ts:270`) is a bag of string unions plus a single
`event: { type: … } & Dict` object. The event is *not* a discriminated union
(`dialog.types.ts`: `event: { type: "OPEN" | "CLOSE" | …; value?: string | null }`), so
payloads are not tied to their event types. The template-literal machinery for nested
targets (`SiblingStateTarget`, `ChildStateTarget`, `AncestorPaths`, `types.ts:150–170`)
is clever but only checks targets against the declared `state` union, never against
the actual definition. `ActionsOrFn` / `EffectsOrFn` / `GuardFn` allow functions
anywhere. Users have hit type friction more than once: #3068 (schemas not exported),
#2770, #2716, #619, #411.

**Execution** (`react/src/machine.ts`):
- State is a `useBindable` (`useState` + ref). A state change runs `flushSync(() => state.set(target))`
  (line 139). `onChange` of that bindable runs exits, cleans up effects, then runs
  transition actions, effects and entries (lines 244–281).
- `send` defers every event with `queueMicrotask` (line 154), plus a `replaces` key
  that drops superseded queued events (`replace-tracker.ts`).
- Start happens in a layout effect, followed by another microtask (line 290). StrictMode
  remounts are handled by composing cleanups for the same path
  (`callAll(existing, cleanup)`, line 262) and by a `hydratedStateRef` "rehydrating"
  path.
- `machine.watch?.(getParams())` is called **during render** (line 324). It registers
  hooks, so the watch body must call `track` the same number of times on every render.
- The returned `Service` is a new object on every render: `state`, `context`, `prop`,
  `computed`, `refs`, `scope`. `connect(service, normalizeProps)` then rebuilds the full
  API object on every render of the root. Ark puts it in context, so every consumer of
  that context re-renders (ark#3429).

**Controlled values.** A bindable with `value: prop("open")` is controlled when the value
is not `undefined` (`react/src/bindable.ts:17`). But *state* (open/closed) is not a
bindable of a prop. So each machine wires it up by hand (`dialog.machine.ts`):

```ts
watch({ track, action, prop }) { track([() => prop("open")], () => action(["toggleVisibility"])) },
// open.on.CLOSE: [{ guard: "isOpenControlled", actions: ["invokeOnClose"] },
//                 { target: "closed", actions: ["invokeOnClose"] }]
// toggleVisibility: send({ type: prop("open") ? "CONTROLLED.OPEN" : "CONTROLLED.CLOSE" })
```

That is three transitions per user event, duplicated across `CLOSE` / `TOGGLE` / `OPEN`.
12 of 52 machines contain `CONTROLLED.*`, and 41 of 52 use `track()`.

**Scope.** `createScope` (`core/src/scope.ts`) provides `getRootNode`, `getById`,
`getActiveElement` and `getDoc` / `getWin`, with a fallback to the global `document` and
`window`. It is half of an environment: timers (`raf`, `setTimeout`) and focus are
imported directly in machines (`dialog.machine.ts:4`: `raf`, `trapFocus`), so a machine
cannot run without a DOM.

**Store.** `@zag-js/store` is a vendored valtio (proxy + `proxy-compare`). Today only
`frameworks/vanilla` (and preact/vue/solid imports) use it to `subscribe` to bindable
refs. React no longer uses it.

**Graph extraction.** Possible for the state/event skeleton by walking `states[*].on`
(`ensureStateIndex` in `core/src/state.ts` already builds a path index). It is
incomplete: prop-driven transitions live in `watch` code, guards may be closures, and
`initialState` is a function. Zag's tests are Playwright e2e (`zag/e2e/*.e2e.ts`). A few
unit tests cover the runtime (`core/tests/state.test.ts`, `frameworks/*/tests/`). There
is no model-based testing.

### XState v5 (comparison, from knowledge; not installed)

- `setup({ types: {} as { context; events; input }, actions, guards, actors, delays }).createMachine({...})`.
  Action, guard, actor and delay names are inferred from the `setup` keys, so a typo in
  the definition is a compile error and typegen is gone. Context and event types are
  *declared* through the phantom `types` field. Actions receive the full event union;
  `assertEvent(event, "X")` narrows it.
- Full statecharts: nested, parallel, history, `always`, `after`, the actor model
  (`invoke`, `spawn`), `enqueueActions`, `emit`. That is far more than headless widgets
  need. The cost is bundle size (core is in the low double-digit kB gzipped, per
  component bundle) plus a big concept surface for contributors and LLMs.
- `@xstate/graph`: `getShortestPaths`, `getSimplePaths`, `createTestModel(machine)` with
  `model.getShortestPaths()`, then `path.test({ states, events })`. That is the
  model-based testing workflow we want. It works because definitions are data plus
  named implementations.
- Takeaways: *copy* the `setup()` inference pattern and the path-generation idea. *Do
  not* copy the actor system or parallel/history states.

### Ariakit stores

Files read: `ariakit/packages/ariakit-store/src/index.ts` (1040 lines),
`ariakit/packages/ariakit-react-store/src/index.tsx`,
`ariakit/packages/ariakit-components/src/disclosure/disclosure-store.ts`.

- `createStore(initialState, ...parentStores)` is a framework-free key/value store with
  `getState`, `setState(key, value)`, `subscribe(keys, listener)` (after a change),
  `sync(keys, listener)` (immediate and synchronous), `batch(keys, listener)`
  (coalesced in a microtask), and `setup` / `init` lifecycles. Stores compose: `mergeStore`
  shares keys between, say, a combobox and a select store. Listeners are keyed per state
  key. Most of the file is fast-path bookkeeping for listeners that subscribe or
  unsubscribe during notification, which shows how hard re-entrancy is to get right.
- Derived state is wired imperatively. `disclosure-store.ts`: `sync(["open","animating"], s => setState("mounted", s.open || s.animating))`.
  No states and no graph. "Open" is a boolean plus `animating` plus `mounted`, and the
  valid combinations are implicit.
- React binding (`useStoreState`) is `useSyncExternalStore(subscribe(keys), getSnapshot)`
  with per-key or selector subscriptions, so a part re-renders only for the keys it
  reads.
- Controlled props (`useStoreProps`) work in two layout effects. One subscribes to the
  key and calls `setOpen` when the store changes. The other forces the store back to the
  `open` prop after every render. That is optimistic-then-revert: the store briefly
  holds a value the parent may reject.

### React Stately (React Aria)

Files read via `git show HEAD:` (the source moved to `packages/react-stately/src/` and
the `@react-stately/*` packages now only re-export):
`packages/react-stately/src/utils/useControlledState.ts`,
`packages/react-stately/src/overlays/useOverlayTriggerState.ts`.

- One React hook per component state (`useOverlayTriggerState`, `useSelectState`, …),
  built from `useControlledState(value, defaultValue, onChange)` plus `useState`. This
  is behaviour as React hooks, with no portable core.
- `useControlledState` reads `isControlled ? value : stateValue` during render (no lag).
  It keeps the latest value in a ref that is reset in `useInsertionEffect`, so
  `setValue(fn)` sees the newest value. It calls `forceUpdate()` even when controlled,
  "so that the layout effect above runs to reset the value". `onChange` fires once per
  `setValue` call, not once per event.
- Cost: no graph, no framework neutrality (Adobe ships React only). Behaviour that spans
  several values (selection plus focus plus open) is coordinated through `useEffect`
  chains inside hooks.

### Base UI

Files read: `base-ui/packages/utils/src/useControlled.ts`,
`base-ui/packages/utils/src/store/{ReactStore,Store,useStore,createSelector}.ts`,
`base-ui/packages/react/src/dialog/store/DialogStore.ts`,
`base-ui/packages/react/src/internals/createBaseUIEventDetails.ts`.

- `useControlled` freezes controlled-ness on the first render and warns on a switch.
  A `setValue` call is ignored when the value is controlled.
- Newer components (Dialog, Popover, Tooltip, Toast, Combobox) moved to
  `class DialogStore extends ReactStore<State, Context, typeof selectors>`. It offers a
  `useSyncExternalStore` store with named selectors (`store.useState("modal")`),
  `useControlledProp(key, value)` (copies the prop into the store in a layout effect,
  which means one render of lag inside the store), and `useSyncedValues`. That
  converges on Ariakit's design.
- **Change event details**: `onOpenChange(open, details)` receives
  `{ reason, event, trigger, cancel(), allowPropagation(), isCanceled }`
  (`createChangeEventDetails`). The consumer learns *why* the value changed and can veto
  the change. Worth copying: in a machine, the reason is the event type for free.
- Cost: state rules are spread across `setOpen` methods, selectors and effects. There is
  no graph, and testing goes through full React render tests.

### Radix

Files read: `radix/packages/react/use-controllable-state/src/use-controllable-state.tsx`,
`radix/packages/react/presence/src/use-state-machine.tsx`.

- `useControllableState({ prop, defaultProp, onChange })`. When uncontrolled, `onChange`
  is called **from a `useEffect`** after the value changed. So it is asynchronous,
  happens after paint, and fires for the initial value too if `defaultProp` changes.
  When controlled it is called synchronously. These differing semantics are a source of
  subtle bugs.
- Radix still needed a state machine for Presence and ScrollArea. The 20-line
  `useStateMachine` (`useReducer` over `{ state: { EVENT: nextState } }`, with event
  names inferred through a `UnionToIntersection` trick) is the minimal form of what we
  are building. Bits UI copies it verbatim
  (`bits-ui/packages/bits-ui/src/lib/internal/state-machine.ts`).

### Headless UI

File read: `headlessui/packages/@headlessui-react/src/machine.ts`,
`components/menu/menu-machine.ts`.

- `abstract class Machine<State, Event>` with `reduce(state, event)` (a `switch` over
  numeric enum action types), `subscribe(selector, callback)` with `shallowEqual` slice
  comparison, `on(type, cb)`, and a `disposables` helper. On the server, subscriptions
  are no-ops and disposables are flushed.
- It is a reducer, not a statechart. "States" are fields (`menuState: MenuState.Open`),
  so nothing can be walked. But it has the same runtime contract we want: framework-free,
  selector subscriptions, a synchronous `send`.

### Kobalte (Solid)

`kobalte/packages/core/src/primitives/create-controllable-signal/create-controllable-signal.ts`:
the same `isControlled ? props.value() : internal()` read-time resolution, with
`onChange` called synchronously in `setValue`. With signals, read-time resolution costs
nothing, which is the model our snapshot should mimic.

## 3. Known pitfalls

| Pitfall | Evidence | Root cause | Our answer |
|---|---|---|---|
| Imperative calls in one tick get lost | #3324 `setOpen(true); setOpen(false)` leaves the dialog open | `send` is deferred with `queueMicrotask`; `connect` reads stale state | Synchronous run-to-completion `send` |
| Update-depth loops | #3005 (`sync: true` bindables plus ResizeObserver), #303 (object/array context) | `flushSync` inside transitions; identity-based equality | No `flushSync`; per-value `equal`; one notification per macro-step |
| Controlled value not re-applied after the parent refuses or clamps | #3444 (number input keeps typed text), #2967 (combobox placeholder after external change), #650 (pin-input) | DOM sync runs in `watch` only when the value *changes*; a refused write changes nothing | A controlled write registers a pending proposal; `setProps` reports `reverted` as an event (§5.4) |
| `onChange` missed in controlled mode | #3018 (vanilla checkbox compares against internal value), #3138 (Svelte controlled dialog never reports `open: true`) | Each framework's bindable has its own equality logic | One bindable implementation in core, compared against the *resolved* value |
| Per-framework interpreter drift | #3442, #3365, #2942 (Svelte teardown reads), #3025 (Svelte collection), #3196 ("does not select … for non-React frameworks"), #3318 | Six interpreters | One interpreter; adapters are about 40 lines each |
| StrictMode double mount | #3081 (wrong nested-layer count with `open` on mount), ark#3842 (scroll lock and `pointer-events` stuck on body) | Effects that start in a microtask after mount; cleanup composition is a workaround (`react/src/machine.ts:262`) | `start()` / `stop()` are idempotent and symmetric; effects belong to the service, not to a React effect |
| Re-render fan-out | ark#3429 (providers not memoized), ark#3972 | New `Service` and API object on every render, passed through context | Immutable snapshot plus selector subscriptions per part |
| SSR | ark#3581 / #3606 / #3555 (hydration mismatches), #385 / #3225 (Solid SSR cleanup crash) | Ids and effects touching globals during server render | Never `start()` on the server; ids come from props or the adapter's `useId`; no global `document` fallback |
| Test environments | #3298 (happy-dom pointer coords break menu highlight), #1697 (`scrollTo` missing in Jest) | Machines import DOM helpers directly | Injected `Environment`; machine tests need no DOM; DOM gaps belong to `@rind-ui/testing/setup` |
| Uncontrolled `onChange` timing | Radix `useUncontrolledState` calls `onChange` from `useEffect` | Change reported after render, not as part of the event | `onChange` fires during the transition with `{ reason, event }` |

## 4. Requirements for rind-ui's runtime

1. **Static definition.** Everything that decides *which* state comes next is data:
   states, transitions, targets, guard names and combinators, action, effect and delay
   names, prop-change edges, controllable bindings. Functions are allowed only in
   implementations, `context` (initial-value factory) and `computed` (derived values,
   never transitions).
2. **Graph extraction.** `toGraph(machine)` returns nodes and edges, including `after`,
   `$sync` (controlled prop) and `$props` (watched prop) edges. Guards stay symbolic and
   can be enumerated where they read props.
3. **Controlled / uncontrolled values** handled once, by the runtime: read-time
   resolution from props, `onChange` with reason and event, mode frozen at creation
   (with a dev warning, as in Base UI and Radix), custom equality, and the refused-write
   case.
4. **Effects with cleanup**, scoped to a state (they start on entry and stop on exit) or
   to the machine's lifetime. Effects can only `send`. They never write context, so
   every state change is an edge.
5. **Injected environment.** `Environment` provides `scheduler`, `dom` (root node, by-id
   lookup, active element), `focus` and `announcer`. Each is a small interface (ISP).
   There is no global fallback inside `core/machine`. The `dom/` modules receive it.
6. **Nested / parallel states: not in v1.** Data: 4 of 52 Zag machines nest (tour,
   floating-panel, color-picker, combobox) and none run in parallel. Orthogonal concerns
   become **separate machines** (presence, dismiss, typeahead) that are composed, or
   **tags** on flat states. Revisit at Combobox (see Open questions).
7. **Computed values**: lazy, memoized per snapshot plus props identity, typed by key.
8. **Events from prop changes**: declared (`onProps: { collection: "COLLECTION.CHANGE" }`),
   not written as code, compared with `Object.is` or a declared `equal`.
9. **Delayed transitions** (`after`): needed by tooltip, hover card, toast and
   long-press. They run on `env.scheduler`, so tests use a fake clock and the graph
   shows them.
10. **Framework binding contract**: `getSnapshot` (stable reference between changes),
    `subscribe`, `send`, `setProps`, `start`, `stop`. Synchronous. No framework imports.
11. **Size budget**: runtime ≤ 2.5 kB min+gz, shared by all components. Graph and path
    code lives in `@rind-ui/testing`, never in the production bundle.

## 5. Decisions

### 5.1 Definition shape (Dialog)

```ts
// core/src/components/dialog/dialog.machine.ts
import { controllable, setup, type } from "../../machine"

export type DialogEvent =
  | { type: "OPEN"; trigger?: TriggerId }
  | { type: "CLOSE"; reason?: "escape" | "outside" | "close-trigger" }
  | { type: "TOGGLE"; trigger?: TriggerId }

export const dialogMachine = setup({
  types: type<{ props: DialogProps; events: DialogEvent; env: FocusEnv & DismissEnv }>(),
  guards: {
    closeOnEscape: ({ props }) => props.closeOnEscape !== false,
    isModal: ({ props }) => props.modal !== false,
  },
  actions: {
    setTrigger: ({ event, set }) => {
      if (event.type !== "CLOSE" && event.trigger) set("trigger", event.trigger)
    },
    focusInitial: ({ env, props }) => env.focus.initial(props.initialFocus),
  },
  effects: {
    trapFocus: ({ env }) => env.focus.trap("content"),
    dismiss: ({ env, send }) =>
      env.dismiss.track("content", { onDismiss: (reason) => send({ type: "CLOSE", reason }) }),
    lockScroll: ({ env }) => env.dom.lockScroll(),
  },
}).machine({
  id: "dialog",
  context: () => ({ trigger: null as TriggerId | null }),
  values: {
    // infers props.open / props.defaultOpen / props.onOpenChange (see 5.2)
    open: controllable("open", { fallback: false, states: { open: true, closed: false } }),
  },
  initial: "closed", // overridden by the bound value: defaultOpen → "open"
  states: {
    closed: {
      on: { OPEN: { target: "open", actions: ["setTrigger"] }, TOGGLE: "open" },
    },
    open: {
      entry: ["focusInitial"],
      effects: ["dismiss", "trapFocus", "lockScroll"],
      on: { CLOSE: "closed", TOGGLE: "closed" },
    },
  },
})
```

Compare Zag's 248 lines: the `isOpenControlled` guard, the `toggleVisibility` action,
`CONTROLLED.OPEN/CLOSE` and `watch` all disappear. The runtime does that work through
`values.open.states`.

### 5.2 How types are inferred

```ts
// core/src/machine/types.ts (sketch — names are the public API)
export type EventObject = { readonly type: string }
type Str<T> = Extract<T, string>

export type GuardExpr<G extends string> =
  | G
  | { readonly not: GuardExpr<G> }
  | { readonly and: readonly GuardExpr<G>[] }
  | { readonly or: readonly GuardExpr<G>[] }

export interface TransitionDef<S extends string, A extends string, G extends string> {
  readonly target?: S
  readonly guard?: GuardExpr<G>
  readonly actions?: readonly A[]
  readonly reenter?: boolean
}
export type Transitions<S extends string, A extends string, G extends string> =
  | S
  | TransitionDef<S, A, G>
  | readonly TransitionDef<S, A, G>[] // first whose guard passes wins

export interface StateDef<S extends string, E extends EventObject, I extends AnyImpl> {
  readonly tags?: readonly string[]
  readonly entry?: readonly Str<keyof I["actions"]>[]
  readonly exit?: readonly Str<keyof I["actions"]>[]
  readonly effects?: readonly Str<keyof I["effects"]>[]
  readonly on?: { readonly [K in E["type"]]?: Transitions<S, Str<keyof I["actions"]>, Str<keyof I["guards"]>> }
  readonly after?: { readonly [K in Str<keyof I["delays"]>]?: Transitions<S, Str<keyof I["actions"]>, Str<keyof I["guards"]>> }
}

type StateKeys<D> = D extends { readonly states: infer S } ? Str<keyof S> : never

// F-bounded: D's own state keys constrain its targets, so `target: "opne"` fails.
export interface MachineDef<D, T extends Types, I extends AnyImpl> {
  readonly id: string
  readonly initial: NoInfer<StateKeys<D>>
  readonly context?: (props: T["props"]) => object
  readonly values?: { readonly [K in string]: Controllable<T["props"], StateKeys<D>> }
  readonly computed?: Record<string, (view: BaseView<D, T>) => unknown>
  readonly onProps?: { readonly [K in keyof T["props"]]?: T["events"]["type"] }
  readonly on?: StateDef<StateKeys<D>, T["events"], I>["on"] // root-level transitions
  readonly states: { readonly [K in StateKeys<D>]: StateDef<StateKeys<D>, T["events"], I> }
}

export function setup<T extends Types, const I extends Implementations<T>>(
  config: { types: T } & I,
): { machine<const D extends MachineDef<D, T, I>>(def: D): Machine<D, T, I> }

/** Phantom carrier for declared types. The `as` is sound: the value is never read. */
export const type = <T>(): T => ({}) as T
```

- **Inferred:** state names (from `states` keys), action, guard, effect and delay names
  (from implementation keys, via the `const I`), context (from the `context` return
  type), computed value types, and prop names for controllables.
- **Declared:** `props`, the `events` discriminated union and `env`. Payload types
  cannot be inferred from string keys. Declaring them once in `types` is the XState v5
  compromise and avoids partial type-argument inference.
- **Compile errors:** a misspelled target or `initial`, an unknown event key in `on`, an
  unimplemented action, guard, effect or delay name, a `values.*.states` map that does
  not cover every state (mapped type over `StateKeys<D>`), and a controllable whose prop
  names do not follow the convention:

```ts
type ControlledKeys<K extends string> = {
  value: K
  default: `default${Capitalize<K>}`
  onChange: `on${Capitalize<K>}Change`
}
export function controllable<
  P,
  const K extends Str<keyof P> & ControllableName<P>,
  S extends string = never,
>(
  key: K,
  options: {
    fallback: NonNullable<P[K]>
    equal?: (a: NonNullable<P[K]>, b: NonNullable<P[K]>) => boolean
    states?: { readonly [St in S]: NonNullable<P[K]> } // binds machine state to the value
  },
): Controllable<P, S>
// ControllableName<P> keeps K only if P also has `default${Capitalize<K>}` and
// `on${Capitalize<K>}Change: (value: P[K], details: ChangeDetails<E>) => void`.
```

- **Actions** receive the full event union. Narrow with `event.type` checks or
  `assertEvent(event, "OPEN")`, which is exhaustive-friendly. No string-typed
  `event.type` anywhere.
- TS 7 risk: F-bounded inference over a large `states` object. Measure on Menu (Zag:
  964 lines) before committing (Open questions).

### 5.3 Implementation signatures

```ts
interface ActionArgs<T extends Types, C, V> {
  readonly event: T["events"]
  readonly props: Readonly<T["props"]>
  readonly context: Readonly<C>
  readonly values: Readonly<V> // resolved controllables
  readonly env: T["env"]
  set<K extends keyof C | keyof V>(key: K, value: (C & V)[K]): void // queued, applied atomically
  send(event: T["events"]): void // queued after the current step (run-to-completion)
}
type GuardFn<T, C, V> = (args: Omit<ActionArgs<T, C, V>, "set" | "send">) => boolean
type EffectFn<T, C, V> = (args: Omit<ActionArgs<T, C, V>, "set" | "event">) => void | (() => void)
type DelayFn<T> = (args: { props: Readonly<T["props"]> }) => number
```

Effects read live `props`, `context` and `values` through getters, so a long-lived
effect never closes over stale values (the Svelte "read after stop" family, #3442,
does not apply: `stop()` revokes `send` and the getters return the last snapshot).

### 5.4 Controlled values — runtime semantics

- **Mode** is frozen at `createService`. `props[key] !== undefined` means controlled.
  A later switch triggers a dev warning and is ignored.
- **Read:** `values[key] = controlled ? props[key] : internal[key]`, resolved when
  the snapshot is *viewed* together with the current props (`service.view(props)`; see
  5.5). There is no layout-effect lag, unlike Base UI's `useControlledProp`.
- **Write** (`set("open", v)`, or a transition into a state bound to a different value):
  - uncontrolled: store the value, run the transition, then call
    `onOpenChange(v, { reason: event.type, event })`.
  - controlled: call `onOpenChange` and **do not** change state. Record a pending
    proposal `{ key, value }`.
- **Prop update** (`setProps(next)`):
  - The bound value differs from the current state's value: perform a `$sync` transition
    to the state mapped from the value. Exits, entries and effects run normally. The
    edge exists in the graph (`event: "$sync:open"`).
  - The pending proposal is not met (the parent refused or clamped): emit
    `{ type: "$reverted", key }`. A machine can declare `on: { $reverted: … }` to re-sync
    DOM-owned text. This fixes the number-input #3444 class of bug.
- Optional `cancel()` in change details (Base UI) works the same for controlled and
  uncontrolled values. A canceled uncontrolled write behaves like a refused controlled
  one.

### 5.5 Runtime interface (what adapters bind to)

```ts
export interface Service<M extends AnyMachine> {
  getSnapshot(): Snapshot<M> // same reference until something changed
  subscribe(listener: () => void): () => void // notified once per macro-step
  send(event: EventOf<M>): void // synchronous; re-entrant sends are queued
  setProps(props: PropsOf<M>): void // diff → $sync / onProps events / $reverted
  view(props: PropsOf<M>): View<M> // snapshot + resolved values + memoized computed
  start(): void // idempotent: activates effects of the current state
  stop(): void // idempotent: runs all effect cleanups, revokes send
  inspect?(listener: (step: Step<M>) => void): () => void // devtools; tree-shaken in prod
}
export interface Snapshot<M> {
  readonly state: StateOf<M>
  readonly context: ContextOf<M>
  readonly internal: InternalValuesOf<M>
}
export interface View<M> extends Snapshot<M> {
  readonly values: ValuesOf<M>
  readonly computed: ComputedOf<M>
  matches(...s: StateOf<M>[]): boolean
  hasTag(t: TagOf<M>): boolean
}
export function createService<M extends AnyMachine>(
  m: M,
  props: PropsOf<M>,
  env: EnvOf<M>,
): Service<M>
```

`start()` after `stop()` (StrictMode, HMR, keep-alive) **re-activates effects only**.
`entry` actions run on real transitions and on the first start. This rule replaces
Zag's `hydratedStateRef` and cleanup-composition workarounds.

React adapter (the whole binding):

```ts
export function useMachine<M extends AnyMachine>(m: M, props: PropsOf<M>, env?: EnvOf<M>) {
  const [service] = useState(() => createService(m, props, env ?? domEnvironment()))
  useIsoLayoutEffect(() => service.setProps(props)) // every commit; diff is cheap
  useEffect(() => (service.start(), () => service.stop()), [service])
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
  return { view: service.view(props), send: service.send, service } // view memoized on (snapshot, props)
}
export function useSelector<M, T>(service: Service<M>, select: (s: Snapshot<M>) => T, eq = Object.is): T
```

Parts below the root read through `useSelector` from context, so an item re-renders only
when *its* `highlighted` / `selected` changes (the answer to ark#3429). On the server,
`start()` never runs (`useEffect`), and `getServerSnapshot` is the initial snapshot,
whose state already reflects `open` / `defaultOpen`.

### 5.6 Graph extraction and model-based tests

```ts
// @rind-ui/testing (not core): pure function over the definition object
export interface MachineGraph {
  readonly id: string
  readonly initial: string
  readonly nodes: Record<string, { tags: string[]; entry: string[]; exit: string[]; effects: string[] }>
  readonly edges: ReadonlyArray<{
    source: string
    target: string | null // null = internal (actions only)
    event: string // "OPEN" | "after:openDelay" | "$sync:open" | "$props:collection"
    guard: GuardExpr<string> | null
    actions: string[]
  }>
}
export function toGraph(m: AnyMachine): MachineGraph
export function paths(g: MachineGraph, opts: { cover: "states" | "transitions"; maxLength?: number }): Path[]
```

- `paths` is a BFS for shortest paths to every state or edge, about 100 lines. It needs
  no `@xstate/graph`, and no new dependency (CLAUDE.md rule).
- Guards that read props become test **configurations**. The model runs each path under
  the prop combinations that make the guard true and false (for example
  `closeOnEscape`). Guards on context are checked by the driver: the step expects the
  edge's target state through contract queries.
- The mapping from events to contract actions is a mapped type over the graph's events,
  so an unmapped event is a compile error unless explicitly `skip`ped:

```ts
testMachine(dialogMachine, dialogContract, () => render(<MyDialog />), {
  events: { OPEN: (d) => d.open(), CLOSE: (d) => d.pressEscape(), TOGGLE: "skip" },
  states: { open: (d) => expect(d.isOpen()).resolves.toBe(true), closed: /* … */ },
})
```

- `toGraph` also feeds the generated docs (states, events, `data-state` values) and
  devtools.

### 5.7 Deliberately different from Zag

| Zag | rind-ui | Why |
|---|---|---|
| Six framework interpreters | One interpreter in `core/machine` | Per-framework drift bugs (§3); 0002 promises cheap new adapters |
| Hand-written `Schema` interface | Names inferred from definition and implementations | One source of truth; typos are compile errors |
| Inline `GuardFn` / `ActionsOrFn` / `choose` / `watch` code | Data only; guard combinators as data; `onProps` and `values` declared | Complete graph; model-based tests and docs generated from it |
| `send` → `queueMicrotask`, state change → `flushSync` | Synchronous run-to-completion queue | #3324, #3005 |
| Controlled state via `CONTROLLED.*` events, guard and `watch` in each machine | `controllable()` with state binding, `$sync`, `$reverted` | 12 machines duplicate it; #3444, #2967, #3018, #3138 |
| Hooks called inside the definition (`bindable` = `useBindable`) | Definition never executes framework code | Framework neutrality; works in tests without React |
| `scope` with global `document` / `window` fallback; DOM helpers imported directly | `Environment` injected, no globals | DOM-free machine tests; #3298 and #1697 become setup problems, not machine problems |
| New service and API object per render, passed through context | Immutable snapshot plus selectors | Re-render fan-out (ark#3429) |
| Nested states via template-literal paths | Flat states, tags, composition | 4 of 52 need nesting; types and runtime stay small |
| Event is one object type with optional payload fields | Discriminated union | CLAUDE.md TypeScript rules |

What we **keep** from Zag: the machine → connect → normalizeProps layering, state-scoped
effects returning cleanups, `tags`, `reenter`, guarded transition arrays (the first
match wins), and `data-scope` / `data-part` (out of scope here).

## 6. Open questions

1. **Hierarchical states.** Do Combobox, Date Picker or Menu need them (Zag combobox
   nests), or do composition and tags cover them? Decide in the Combobox research note.
   The runtime must not paint us into a corner: keep state keys free of `.` so
   `"parent.child"` stays available.
2. **Machine composition.** Submenus, nested dialogs and the presence-plus-dialog pair:
   parent-owned child services (`spawn`-lite) or sibling services wired by the adapter?
   This affects the graph (product versus separate graphs).
3. **Event narrowing in actions.** Is `assertEvent` enough, or should a transition carry
   typed `params` for its actions? Measure on Select.
4. **Environment granularity.** One `Environment` with optional capabilities, or a
   per-machine `env` type (as sketched) assembled by the adapter? The latter is
   ISP-pure but makes `domEnvironment()` generic.
5. **TS 7 inference cost** of the F-bounded `const D` on a 60-transition machine. If it
   is slow or the errors are unreadable, fall back to a `satisfies MachineDef<…>` check
   with explicit state union.
6. **Large collections in context.** Immutable snapshots plus 10k items: store
   collections outside the snapshot (version counter) and let parts select by key?
   Decide in the `collection/` note.
7. **`$reverted` ergonomics**: is a machine-level event the right tool, or should
   connect expose `pending` so the part re-renders DOM-owned text itself?
8. **Cancelable changes**: adopt Base UI's `cancel()` / `allowPropagation()` in
   `ChangeDetails` from day one, or only `reason` and `event`?
9. **Devtools / `inspect`**: does it ship in core behind a dev-only flag, or only in
   `@rind-ui/testing`?

## 7. Outcome of open question 5 (add-foundations, task 2.9)

Measured on TypeScript 7.0.2 (`tsc --extendedDiagnostics`, three runs, identical):

- **The F-bounded sketch does not compile as written.** `MachineDef<D>` with
  `states: { [K in StateKeys<D>]: … }` reports TS2313 ("Type parameter 'K' has a circular
  constraint").
- **Adopted instead:** `machine<const S extends string>(def: MachineDef<S, T, I>)`, where
  `states` is `{ [K in S]: StateDef<NoInfer<S>, …> }` and `initial` / targets are
  `NoInfer<S>`. S is inferred from the keys of `states`. Because the parameter is not a bare
  type parameter, nested object literals keep excess-property checks, so an unknown event
  key in `on` is an error at that key (TS2353). The F-bounded form would have needed a
  separate validation type for that.
- **Cost:** a synthetic machine with 20 states, 60 guarded transitions (each guard
  `{ and: [g, { not: g' }] }` plus an action), 10 actions and 5 guards checks in **8 ms**
  (3,545 instantiations, 33 ms total including program setup, against 21 ms for an empty
  file).
- **Error readability:** a misspelled target reports TS2322 on the transition's line,
  naming the bad literal and the full state union. A misspelled event key reports TS2353 at
  the key. Both are readable without help.
- **Regression guard:** `packages/core/src/machine/types.test-d.ts` has one
  `@ts-expect-error` per item of "Definitions Are Type-Checked".
