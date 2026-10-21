## Context

`domEnvironment(options)` (`packages/core/src/env/dom-environment.ts`) returns one object with
every capability. The React provider memoises one per provider value; `useEnvironment()`
returns it and parts pass it to `useMachine` (70 calls) or read it directly (170 calls).
Machines type their needs (`env: AnnouncerEnv & ClipboardEnv & SchedulerEnv`), so the type
information already exists; only the runtime builds everything.

Usage in source: `env.modality` 234 reads, `env.announcer` 58 (about 30 components),
`env.validity` 7, `env.dateClock` 3, `env.clipboard` 1, `env.layout` 1.

## Goals / Non-Goals

**Goals:** a component's bundle holds only the capability implementations its parts request;
the compiler catches a missing request; one instance per provider; no change to provider props
or `domEnvironment`'s result.

**Non-Goals:** on-demand modality; async capabilities; a plugin system.

## Decisions

1. **Capability objects in core** (`env/capability.ts`):
   ```ts
   interface Capability<K extends string, T> {
     readonly key: K
     create(base: BaseDomEnvironment, options: DomEnvironmentOptions): T
   }
   ```
   One per on-demand capability, next to its implementation (`announcerCapability` in
   `dom/live-announcer.ts`, …), each `/* @__PURE__ */`. `create` returns the option when given
   (`options.clipboard ?? domClipboard(...)`), so "option wins" lives in one place per capability.
2. **`baseDomEnvironment(options)`** builds the base only. `domEnvironment(options)` becomes
   `withCapabilities(baseDomEnvironment(options), options, allCapabilities)`: same result as today,
   still public, and the only module that imports every implementation.
3. **Per-provider cache.** The provider value holds the base environment and a
   `Map<Capability, unknown>`; `useEnvironment(...caps)` returns a memoised object
   `{ ...base, [cap.key]: cache.get(cap) ?? build }`. The memo key is the provider value plus
   the capability list (stable module constants, so a `useMemo` with them as deps is stable).
   Why a Map keyed by the object, not by key string: two capability objects can never collide,
   and a test can pass its own.
   The default environment (no provider) is one module-level lazy base + cache, as today's
   default `domEnvironment()`.
4. **Types.** `useEnvironment<const C extends readonly Capability<string, unknown>[]>(...caps: C):
   BaseDomEnvironment & ProvidedBy<C>`, with `ProvidedBy` mapping each `Capability<K, T>` to
   `{ readonly [P in K]: T }`. `useMachine`'s implicit env becomes the base only; a part whose
   machine needs more passes `useEnvironment(...)` as the third argument, so a missing request
   fails on `EnvOf<M>`. The cast in `useMachine` today ("domEnvironment implements every
   capability") goes away.
5. **Migration of parts** is mechanical and compiler-driven: switch `useMachine` to base env,
   run `tsc`, add the requested capabilities where it fails. Delegate to a Sonnet subagent with
   the error list.
6. **Leak check** in `scripts/size.mjs`: metafile inputs of `Button` must not include
   `live-announcer`, `clipboard`, `collection-layout`, `constraint-validity`; `Clipboard` must
   include `clipboard`. Checked by module path in the esbuild metafile, not by string search.

## Risks / Trade-offs

- [Component that announces only from a shared helper misses the request at the type level
  because the helper takes the full env] → helpers take the narrow capability type
  (`AnnouncerEnv`), so the call fails to compile.
- [Order: the announcer must exist before the first announcement] → `create` runs during
  render (synchronous, no DOM writes until the first `announce`), as `liveAnnouncer` already
  defers creating regions.
- [Testing package builds environments] → it keeps `domEnvironment()` (complete), so drivers and
  fixtures are unchanged.

## Migration Plan

No consumer change: provider props and `domEnvironment` are the same. A consumer passing a
custom `env` to `useMachine` is unaffected.
