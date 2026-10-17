---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Toast:
- a `createToaster()` store usable from any module, with `Toaster` and `Toast.*` parts;
- lifetimes that pause on hover, focus, a hidden page, a swipe, while no region is mounted, beyond the limit, or by the API;
- announcements through the announcer, with no live regions;
- the F6 hotkey into the region and back, swipe to dismiss, promise toasts;
- the `toaster` and `toast` contracts with the `getToaster` and `getToast` drivers, and the theme stylesheet.

New capability: `PageVisibility` (`env.visibility`), with `fakeVisibility` in `@rind-ui/testing`. The contract `Key` gains `F6`.
