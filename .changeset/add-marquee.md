---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Marquee: a looping band of content moved by CSS, with a PauseTrigger, hover and keyboard-focus pauses (WCAG 2.2.2), reduced motion shown still and wrapped, hidden untabbable copies (`autoFill` up to 32), continuity when the speed, size or direction changes, and focus brought into view without scrolling. Core: `core/dom/marquee-motion` (`observeMarquee`, `retime`, `mirror`, `reveal`, `untabbable`). Testing: `getMarquee`; the generic hidden-focus invariant accepts `tabindex="-1"` inside a hidden copy. Theme: `marquee.css` in the decoration family; `pause` and `play` icons.
