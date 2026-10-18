---
"@rind-ui/theme": patch
---

Drawer: the positioner clips (`overflow: clip`) instead of hiding, so it is no longer a scroll container. In WebKit, focus moving into a drawer while it slid in scrolled the positioner, and the panel jumped at the end of the animation.
