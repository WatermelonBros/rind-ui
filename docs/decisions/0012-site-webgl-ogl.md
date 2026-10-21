# 0012 — OGL for the landing's WebGL scene

Status: accepted · 2026-10-21

## Context

The landing page (`apps/site`, home only) is being rebuilt around one continuous scroll story,
"The Skin": a WebGL membrane stretched over a component's skeleton (its parts as a wireframe,
its machine's states as nodes) that peels, re-forms and changes material with the crisp/juicy
switch. Award-level library sites carry a scene like this; ours has to stay inside the site's
performance budget (LCP under 1.5 s, CLS 0) and its accessibility rules.

0002 asks for a decision record before any new runtime dependency. This one is for the docs
site only: no published package (`@rind-ui/*`) gains a dependency.

## Decision

Allow [`ogl`](https://github.com/oframe/ogl) (1.0.11, Unlicense, no dependencies) as a
dependency of `@rind-ui/site`, imported only by the home page's scene module.

- **Loaded after first paint.** The scene is a dynamic import started after the LCP element
  has painted; the page is complete and readable without it.
- **Fallbacks are the current page.** No WebGL, `prefers-reduced-motion: reduce`, or a failed
  context: the scene never mounts, and the DOM sections render as they do today.
- **Decorative.** The canvas is `aria-hidden`, never focusable, and never carries content
  that is not also in the DOM.

Alternatives considered:

- **three.js**: the richest ecosystem, about six times OGL's weight for what the scene uses
  (meshes, a few custom shaders, instanced points). Rejected for the LCP budget.
- **Raw WebGL**: no dependency, but we would rewrite OGL's renderer, geometry and program
  plumbing by hand. Rejected: same bytes, more code to maintain.

## Consequences

- `apps/site/package.json` gains `ogl` at an exact version.
- The site's bundle check covers the home page's lazy chunk; the scene's size is reported in
  each PR that changes it.
- No change to CLAUDE.md's allowed runtime dependencies, which are the published packages'.
