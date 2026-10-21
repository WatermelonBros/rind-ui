## 1. Core

- [x] 1.1 `env/capability.ts`: `Capability<K, T>`, `ProvidedBy<C>`, `withCapabilities`
- [x] 1.2 Capability objects for announcer, clipboard, collection layout, constraint validity, page visibility, date clock, next to their implementations, pure-annotated
- [x] 1.3 `baseDomEnvironment(options)`; `domEnvironment(options)` rebuilt on base + all capabilities, same result (existing env tests pass unchanged)
- [x] 1.4 Tests: capability built once per environment, option wins, not requested → no live region

## 2. React

- [x] 2.1 Provider holds base env + per-provider capability cache; default environment likewise
- [x] 2.2 `useEnvironment(...caps)` typed `BaseDomEnvironment & ProvidedBy<C>`; `useMachine` default env is the base (drop the cast)
- [x] 2.3 Type test: Clipboard machine with an env missing `clipboard` fails to compile
- [x] 2.4 Migrate every part flagged by `tsc` to request its capabilities; narrow machines typed with the whole `DomEnvironment`
- [x] 2.5 Tests: shared announcer across two components under one provider; no-provider part announces

## 3. Size

- [x] 3.1 `scripts/size.mjs`: metafile check (Switch without announcer, clipboard, layout; Clipboard with `clipboard`)
- [x] 3.2 Re-measure and lower `scripts/size-budgets.json`

## 4. Verify and ship

- [x] 4.1 `pnpm typecheck`, `pnpm test`, `pnpm lint`, size check pass; site examples pass axe
- [x] 4.2 Changeset (minor, `@rind-ui/core` and `@rind-ui/react`: new `baseDomEnvironment`, capability objects, `useEnvironment` arguments)
