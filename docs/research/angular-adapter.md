# Angular adapter — research

Status: done · Wave: infrastructure

How the libraries that ship headless Angular primitives bind behaviour to the DOM, what the
platform forces on `@rind-ui/angular`, and what went wrong for them. The component behaviour is
unchanged (machines and connect are shared), so the per-component research notes still apply
as written; [framework-adapters.md](framework-adapters.md) covers Vue and Svelte. Versions read:
Angular 22.2 (current), ng-primitives 0.131, Angular Aria 22.2, Radix NG and Spartan `main`
(2026-10).

## How the others built it

### ng-primitives

- Source: `packages/ng-primitives/state/src/index.ts` (`createPrimitive`, `controlledState`,
  `attrBinding`, `dataBinding`, `listener`), `toggle/src/toggle/toggle-state.ts`,
  `toggle/src/toggle/toggle.ts`, `interactions/`.
- API shape: every part is an attribute **directive** on the consumer's element
  (`<button ngpToggle>`), never a component with its own host. Inputs are prefixed
  (`ngpToggleSelected`, `ngpToggleDisabled`), outputs `ngpToggleSelectedChange`, so
  `[(ngpToggleSelected)]` works. State is reached with `exportAs` (`#t="ngpToggle"`) or an
  `injectToggleState()` function for reusable wrappers.
- State model: a framework-neutral-ish factory (`ngpToggle({ selected, disabled, … })`) that
  takes signals and runs in an injection context. `controlledState` latches "controlled" once
  the input is defined and never writes internal state afterwards.
- Notable: host attributes are not template host bindings: `attrBinding`/`dataBinding` write
  them imperatively from an effect (`afterRenderEffect` in the browser, plain `effect` on the
  server so the server HTML carries them). Listeners go through `addEventListener` outside the
  zone, wrapped in `untracked()` so a signal write inside a handler that the browser dispatches
  during rendering does not throw NG0600. This is exactly the "spread a props object on the
  host" shape our connect output needs.
- Problems: see the bug table — controlled values not respected before `controlledState`
  (#279), state injected as `null` in a reusable wrapper's constructor (#548), a content query
  that does not cross component boundaries (#964), the overlay leaking the trigger's injector
  (`ControlContainer`) into the content (#671, #677), comment root nodes treated as elements
  (#976), NG0600 from a signal written during render (#436).

### Angular Aria (`@angular/aria`, Angular team)

- Source: `angular/components/src/aria/toolbar/toolbar.ts`, `src/aria/private/` (UI patterns
  and behaviours), `src/aria/private/utils/collection.ts`, `ui-pattern-rules.md`.
- API shape: attribute directives (`[ngToolbar]`, `[ngToolbarWidget]`) with **static** `host`
  metadata (`'[attr.aria-orientation]': '_pattern.orientation()'`, `'(keydown)': …`).
- State model: the behaviour lives in framework-free "UI pattern" classes that take
  `SignalLike` inputs (their own minimal signal interface, so the patterns do not import
  `@angular/core` types) — the same split as our machine + connect, written by the Angular
  team.
- Notable: collections are ordered by DOM position (`SortedCollection`: items register,
  sorted with `compareDocumentPosition`, re-sorted by a `MutationObserver` on structural
  changes), not by content queries, so items projected through wrappers still join.
- Problems: patterns used as `hostDirectives` lose pointer handling (#32504, open); a required
  input read in `ngOnDestroy` before the first change detection throws NG0950 (#33972); the
  composite acts on the active item rather than the focused one after a scripted focus move
  (#33934). Static host bindings cannot express a connect object whose attribute set varies.

### Radix NG (`@radix-ng/primitives`)

- Source: `packages/primitives/toggle/src/toggle.ts`, `composite/`, `core/`.
- API shape: attribute directives (`[rdxToggle]`) with static host bindings; Base UI's API
  ported (`pressed` as `model()`, `defaultPressed`, cancelable change details); behaviour
  shared through `hostDirectives: [RdxCompositeItem]`.
- Notable: cancelable change event details, like our `ChangeDetails.cancel()`.
- Problems: tabs **projected** into a wrapper whose template owns the tab list never join the
  list's composite — no roving tabindex, no arrows, no default selection (#451): the element
  injector follows the template where an element is *declared*, not where it is projected.
  `model()` for a controlled value: the directive writes its own model, so a one-way
  `[pressed]` binding is not really controlled.

### Spartan (`@spartan-ng/brain`)

- Source: `libs/brain/toggle/src/lib/brn-toggle.ts`, `libs/brain/*`; built on `@angular/cdk`.
- API shape: attribute directives restricted by element (`button[brnToggle]`); styled layer
  (`helm`) copied into the app, shadcn-style.
- State model: `model<'on' | 'off'>()` written by the directive itself.
- Problems: ids from a `static _uniqueId` counter per class (`brn-toggle-${++id}`), so the
  server and client numbering only agree by luck, and two counters sharing one namespace
  collided (#1665); id/for bindings broken with signals (#1573); `window`/`getBoundingClientRect`
  on the server (#215, #1675).

### Angular CDK

- Source: `src/cdk/a11y/id-generator.ts`, `src/cdk/a11y`, `src/cdk/overlay`.
- Ids: `_IdGenerator.getId(prefix)` keeps a module-level counter per prefix (plus `APP_ID`
  when it is not the default `ng`). Angular has **no `useId`**: nothing in `@angular/core` 22
  gives an SSR-stable id.
- Material on SSR + hydration: a click queued by `withEventReplay()` and replayed later throws
  `composedPath called during event replay` (#33386): Angular patches `composedPath` on
  replayed events to throw.

## Platform facts that decide the design

- **Build needs the Angular compiler.** Decorators and signal inputs must be compiled by
  `ngc` (`@angular/compiler-cli`). Library output is *partial* compilation
  (`compilationMode: "partial"`, `ɵɵngDeclareDirective`), linked by the consumer's CLI.
  `tsdown` cannot produce it. Prototype (scratchpad, Angular 22.2): `ngc -p` with
  `compilationMode: "partial"` emits per-file ESM + `.d.ts`; that output rendered through
  `@angular/platform-server` `renderApplication` with every attribute in place.
- **TypeScript version.** `@angular/compiler-cli` 22 requires `typescript >=6.0 <6.1`; the
  repo is on TypeScript 7 (native, no JS compiler API). `packages/angular` needs its own
  `typescript@~6.0` dev dependency for `ngc` (pnpm keeps both), and its `typecheck` script is
  `ngc --noEmit` (which also type-checks templates), not `tsc` 7.
- **JIT is not enough for tests.** Bundled without `ngc` (esbuild + `@angular/compiler` at
  runtime), signal inputs and `model()` are invisible: the prototype's `[(pressed)]` failed with
  NG0303 "Can't bind to 'pressed'". Tests must compile AOT: `@analogjs/vite-plugin-angular`
  (2.9, peers `vite ^6–8`, used by Analog and `@analogjs/vitest-angular`, which peers
  `vitest ^5`) in the Vitest project for `packages/angular`. Dev dependency only.
- **No wrapper elements.** A component always renders its host element; a directive does not.
  Parts are directives on the consumer's element, so the markup matches React's element for
  element. A part that must render elements of its own (a hidden form input, an icon) is a
  component with an attribute selector or inserts a sibling view through its
  `ViewContainerRef` (a directive's view container inserts after its host).
- **The host tag is known at creation.** `ElementRef.nativeElement.tagName` is available in the
  constructor, on the server too, so connect's `tag` needs no measured re-render (Vue's
  `measured` ref).
- **Signals and change detection.** Angular 21+ is zoneless by default. The machine's snapshot
  goes into a `signal`; connect output is a `computed`; host writes happen in an effect.
  Signal writes from event handlers must run `untracked` (NG0600 otherwise, ng-primitives #436).
- **Effects and SSR.** `effect()` flushes before the server serialises, so attributes written
  from an effect are in the server HTML (prototype verified). `afterRenderEffect` /
  `afterNextRender` never run on the server: environment access (`window`, layout,
  `getComputedStyle`, `matchMedia`) goes there or behind `PLATFORM_ID`.
- **Hydration.** Angular hydration reuses the server DOM and requires the same *structure*;
  attribute differences are patched, not reported. Nodes added or moved by direct DOM
  manipulation before hydration finishes break it (NG0500): portals attach after hydration
  (`afterNextRender`) or carry `ngSkipHydration`.
- **Event replay.** `withEventReplay()` replays only listeners Angular knows from templates
  (the `jsaction` attributes it serialises). Listeners added with `Renderer2.listen` /
  `addEventListener` are not replayed, so a click before hydration is lost (as for an
  unhydrated React tree). Replayed events throw on `composedPath()`; core's dismiss, hover
  intent and press read it (`dom/dismiss.ts`, `dom/hover-intent.ts`, `dom/press.ts`), which is
  safe only while our listeners are not replayed.
- **Two-way binding is a naming convention.** `[(pressed)]` desugars to `[pressed]` +
  `(pressedChange)`, for an `input()` + `output()` pair as much as for `model()` (prototype verified:
  `[(pressed)]="v"` on an `input()` + `output()` directive updates `v`). With
  `input()` + `output()`, a one-way `[pressed]` stays controlled (the directive never writes
  it), which is our machines' semantics; `model()` writes itself and breaks it (Radix NG,
  Spartan, ng-primitives #279).
- **Element injectors follow declaration, not projection.** `inject(Parent)` from a part
  resolves through the template where the part is written. A part projected through a
  consumer's wrapper component cannot reach a parent that lives in the wrapper's own template
  (Radix NG #451); content queries do not cross component boundaries either (ng-primitives
  #964).
- **Ids.** No SSR-stable id primitive. Hydration does not compare attribute values, so the
  client re-writes every id on first render and each render is internally consistent; the
  ids only need to be unique per application (`APP_ID` prefix + per-application counter, not
  a module-level counter shared across server requests).
- **Listener order on one element.** A listener a directive adds in its constructor runs
  *before* the consumer's template `(click)` on the same element; one added in `ngOnInit` runs
  *after* it (prototype verified: `['part', 'consumer']` vs `['consumer', 'part']`). Template
  listeners are registered in the creation pass, after the directives are instantiated and
  before `ngOnInit`.
- **Several directives on one element.** Composition (React's nested `asChild`, e.g. a Tooltip
  trigger that is also a Toggle) is two directives on one element. Each writes the host, so
  two parts writing the same attribute (`id`, `aria-describedby`, `data-state`) need one
  writer per element that merges them in a fixed order.
- **Dev checks.** Angular builds define `ngDevMode`, not `process.env.NODE_ENV` (which core and
  our parts read; `@angular/build` 22.2's define block has `ngDevMode`, `ngJitMode`,
  `ngServerMode`, `ngHmrMode`). The CLI bundles with esbuild on `platform: "browser"`, and
  esbuild defines `process.env.NODE_ENV` itself there (`"production"` when minifying,
  `"development"` otherwise): bundling `dist` that way leaves no `process.env` reference, with
  or without `--minify`. So the parts keep `process.env.NODE_ENV`, like every other adapter.
- **Node ESM.** `ngc` keeps the source's extensionless relative imports, which Node's ESM loader
  rejects (`ERR_MODULE_NOT_FOUND` on `dist/toggle/toggle`); a consumer's SSR or a test runner
  that leaves the package external loads it that way. The build rewrites them to the files
  (`scripts/angular-esm.mjs`) and fails unless Node imports the root entry.

## Mapping from React

| React (`@rind-ui/react`) | Angular (`@rind-ui/angular`) |
|---|---|
| `<Toggle.Root>` renders a `<button>` | `<button rindToggleRoot>`: the part is a directive on the consumer's element |
| `asChild` / `render` (element substitution) | Native: the consumer always writes the element; no prop. A part that renders its own internals (hidden input) inserts a sibling view |
| `mergeProps` (consumer handler first, `preventRindHandler()`) | One binder per element applies connect output with `Renderer2`: attributes set/removed by diff, styles per property (`setStyle`), classes never replaced; the consumer's `(click)` runs first and may call `preventRindHandler()` |
| `ref` / `composeRefs` | Not needed: the consumer has the element (`#el`); the part reads it with `inject(ElementRef)` |
| Context (`createContext`) | DI: the root provides an injection token; parts `inject()` it. Collections register with the root and sort by DOM position |
| Children as a function / render props (state) | `exportAs` + template reference (`#t="rindToggle"`, `t.state().pressed`), control flow (`@if`) for fallbacks |
| Controlled `pressed` + `onPressedChange` | `input()` `pressed` + `output()` `pressedChange(value, details)`; `[(pressed)]` works; `defaultPressed` for uncontrolled |
| `useId` | an id service: `APP_ID` + per-application counter; `id` input overrides |
| Portal (`createPortal`) | `<ng-template rind…Portal>` + `ViewContainerRef.createEmbeddedView`, element root nodes moved to the layer container after hydration |

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| ng-primitives | #279 | toggle group changes state although the bound value did not change | directive wrote its own state in controlled use | `controlledState` latch | never write a controlled input; propose through the output |
| ng-primitives | #436 | NG0600 "writing to signals is not allowed while Angular renders" | a listener fired during render wrote a signal | `untracked()` around handlers | every listener the binder adds runs `untracked` |
| ng-primitives | #548 | injected state `null` in a wrapper's constructor when `[(ngModel)]` is bound | state created after the wrapper's constructor ran | lazy/hoisted state signal | exported state is a signal read lazily, never a snapshot in a constructor |
| ng-primitives | #964 | form field misses the control's required state and errors when the control is in a child component | `contentChild` does not cross component boundaries | DI registration instead of a content query | parts register with their root through DI; no content queries for structure |
| ng-primitives | #671, #677 | `ngModel`/`formControlName` in a popover bind to the outer form or throw NG01350/NG01050 | portal created with the trigger's injector and view container | portal created from the content template's own declaration | portal views are created from the `ng-template`'s own `ViewContainerRef` |
| ng-primitives | #976 (open) | overlay whose template starts with `@if` never opens or never closes | `rootNodes` include comment anchors; element methods called on them | open | filter `rootNodes` to elements before moving or querying them |
| ng-primitives | #122 | infinite `ngModel` loop | `onChange` called from an effect on every value change, including `writeValue` | fixed in schematic | a `ControlValueAccessor` calls `onChange` only for user-originated changes |
| ng-primitives | #762 | every pointer move over a toast runs app-wide change detection | listener inside the zone | listeners outside the zone | listeners run outside `NgZone`; only signal writes schedule rendering |
| ng-primitives | #83, #597 | `getComputedStyle` / `window is not defined` on the server | environment read in constructors | platform checks | environment access only in `afterNextRender` or through core's `Environment` |
| Angular Aria | #32504 (open) | combobox/listbox as `hostDirectives` stop handling clicks | host bindings of host directives | open | do not ship parts meant to be used as `hostDirectives`; test the wrapper case |
| Angular Aria | #33972 | NG0950 in `ngOnDestroy` before first change detection | required input read before it was set | fixed | cleanup never reads inputs; it reads what setup stored |
| Angular Material | #33386 | `composedPath called during event replay` | Angular patches replayed events | fixed in Material | our listeners are not replayed; never move them into template bindings without guarding `composedPath` |
| Radix NG | #451 | projected tabs get no roving tabindex, arrows or default selection | element injector follows declaration | fixed by registering with the root context | collections register with the root (reachable from any declaration under it) and order by DOM position |
| Spartan | #1665 (open) | "id already exists" throw in dialogs | two counters in one id namespace | open | one id source per application |
| Spartan | #1573 | id/for bindings broken with signals | id bound once, signal read too early | fixed | ids are part of connect output, applied with the rest |

## Testing notes

- Drivers are framework-free (they take a Testing Library `screen` or a container), so the
  React contract model tests run unchanged against Angular renders; only `setup` differs.
- `fixtures/mount.ts`: `createApplication({ providers: [provideZonelessChangeDetection()] })`
  + `createComponent(Fixture, { hostElement, environmentInjector })`, attach to `ApplicationRef`;
  `rerender(next)` sets the fixture's signals and awaits `appRef.whenStable()`. No TestBed (it
  needs `initTestEnvironment` and a zone).
- `fixtures/parity.ts`: server — `renderApplication` (`@angular/platform-server`), the fixture
  host's inner HTML; client — the mounted fixture's DOM after `whenStable()`. Before
  `canonicalHtml`, strip Angular's incidentals in the Angular fixture (keeps
  `@rind-ui/testing` unchanged): the directive selector attributes (`rindtoggleroot=""`),
  `ng-version`, `ng-server-context`, `ngh`, `ng-reflect-*`, and emulated-encapsulation
  attributes (fixtures use `ViewEncapsulation.None`). Comments are already dropped.
- The Vitest project for `packages/angular` runs through `@analogjs/vite-plugin-angular`
  (AOT); its `tsconfig.spec.json` points at TypeScript 6.

## Decisions

- **Parts are directives** on the consumer's element, one per React part, selector
  `[rind<Component><Part>]` (`rindToggleRoot`, `rindToggleIndicator`), `exportAs`
  `rind<Component><Part>`, exported in a `Toggle` const tuple for `imports: [Toggle]`
  (`export const Toggle = [ToggleRoot, ToggleIndicator] as const`). No element-restricted
  selectors: connect's `tag` handles a non-button host like React's `asChild`.
- **One binder per element** (`bindProps`), applying connect output through `Renderer2`:
  attributes by diff (`false`/`undefined` removed, `true` → `""`), `inert` mapped like Vue,
  styles per property, handlers through one listener per event, outside the zone, `untracked`.
  Directives sharing an element share its binder, merged in a fixed order.
- **Handler order**: the binder adds its listeners in `ngOnInit`, so the consumer's own
  `(event)` runs first, as in React's `mergeProps`. It can call `preventRindHandler()`: a
  capture-phase listener added in the constructor installs the extension before either runs.
- **Machines**: `useMachine` stores the snapshot in a signal; props from inputs are read
  through `computed`; cleanup through `DestroyRef`.
- **Controlled values**: `input()` + `output()` pairs (`pressed` / `pressedChange`), never
  `model()`; `[(pressed)]` works; `default*` inputs for uncontrolled use; the output carries
  the change details so `details.cancel()` vetoes like React.
- **Context**: an injection token per component root; collections register with the root and
  order by DOM position (core's collection), never by content queries.
- **State to templates**: `exportAs` with a `state` signal; no structural directives in the
  first batches.
- **Ids**: an `@Injectable({ providedIn: "root" })` id source (`APP_ID` + counter); an `id`
  input overrides.
- **SSR**: host attributes written in `effect` (present in server HTML); environment work in
  `afterNextRender`; portals attach after hydration.
- **Build**: `ngc` partial compilation of `src/` into `dist/` (per-file ESM + `.d.ts`), the
  same subpath `exports` as `@rind-ui/vue`; `typescript@~6.0` dev dependency;
  `typecheck` = `ngc -p tsconfig.json --noEmit`. Dev dependency `@analogjs/vite-plugin-angular`
  for tests. No `@angular/cdk` (core already has dismiss, focus trap, floating positioning).
- **Peer range**: `@angular/core` and `@angular/common` `>=21` (zoneless default, stable
  `afterRenderEffect`/`linkedSignal`); compiled with 22.
- **Deliberately different from the others**: no prefixed inputs (`pressed`, not
  `rindTogglePressed`: the parts are always applied as attributes, and Angular resolves inputs
  per directive); no `model()`; no `@angular/cdk`; parts not designed as `hostDirectives`.

## Open questions

- Does `ngc` partial output linked by an Angular 21 CLI work (peer `>=21`)? Prove with a
  consumer build in the scaffold, or narrow the peer range to `>=22`.
- Forms: `ControlValueAccessor` and Signal Forms (`FormValueControl`) for form-capable parts
  are an Angular-only API surface; React has no counterpart. Out of the first batches; a
  separate change once Checkbox/Switch ship.
