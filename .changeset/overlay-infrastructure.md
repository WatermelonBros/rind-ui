---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Overlay infrastructure: a per-document layer stack with explicit parentage, dismissal by
Escape, outside press and outside focus (vetoable, with reasons), focus containment and
restore without sentinels, outside hiding with `inert`, a reference-counted scroll lock,
presence for exit animations, portal target resolution and the `overlayEffect` that ties
them together. React gains `Portal`, `usePresence` and `LayerProvider`; testing gains the
`modal` and `presence` traits, a document-clean check after unmount, and driver support for
overlays; the theme gains overlay base styles.
