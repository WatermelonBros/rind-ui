---
"@rind-ui/core": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Floating positioning: a `position` capability (`domPositioning`, on `@floating-ui/dom`) that
places anchored popups against an element, a virtual rectangle or a point, with collision
avoidance, available-size and anchor-size CSS variables, an arrow, a hidden-anchor state,
tracking (visual viewport, layer stack, ancestor animations), strategy `auto`, side lock and
a manual mode for CSS anchor positioning; connect helpers for the positioner, content and
arrow parts; the `positioningQueries` contract fragment, `fakePositioning()` and the
`anchored` layout invariant in `@rind-ui/testing`; and the positioner stylesheet.
Fix: a registered trigger is no longer made inert while its layer exits, so focus returns to it.
