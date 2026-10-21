---
"@rind-ui/core": minor
"@rind-ui/react": minor
---

Components ship only the environment capabilities they use. The announcer, clipboard,
collection layout, constraint validity, page visibility and date clock are on-demand
capabilities (`announcerCapability`, …) built by the provider when a component asks for them,
once per provider: most components are 0.5–2 kB gzip smaller. New: `baseDomEnvironment`,
`extendEnvironment`, `Capability`, `ProvidedBy`, and `useEnvironment(...capabilities)`.
`domEnvironment()` and the provider's props are unchanged. `useMachine` now requires its
`env` argument when the machine needs more than the base environment.
