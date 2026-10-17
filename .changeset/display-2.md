---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Image, Progress, Meter and Alert. Image: the shared image-status machine with one stable name in every status (the `<img>`'s own `alt` while it shows, Root's when it is gone) and a lazy-safe server render; `getImage`, `image.css`. Progress and Meter: the shared `range-value` model, determinate/indeterminate progress with completion announcements, meter zones from low/high/optimum; `getProgress`, `getMeter`, stylesheets. Alert: an inline message announced through the Announcer (never its own live region), dismissable with focus moved past it; `getAlert`, `alert.css`. Contracts can declare `absentIn` (states where the component is unmounted) for the model runner.
