---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Badge, Skeleton and Avatar. Badge: static status text that is never a live region, a `label` for assistive technology and a development check for a host whose `aria-label` hides the count; `getBadge`, `badge.css`. Skeleton: one busy region per loading area, hidden and inert placeholders, a loading text outside the region, an optional completion announcement and a CSS shimmer that stops under reduced motion; `getSkeleton`, `skeleton.css`. Avatar: the shared `image-loading-status` machine read from the rendered `<img>` (no probe, cached and server-rendered images never flash the fallback), one stable name on Root, fallback timing, Avatar Group with an overflow label; `getAvatar`, `avatar.css`. Aspect Ratio is documented as a recipe on the native CSS property: there is no component.
