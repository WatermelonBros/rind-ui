---
"@rind-ui/core": patch
"@rind-ui/react": patch
---

Development warnings are dropped from production bundles: the checks in Avatar, Breadcrumbs, Pagination, Pin Input, the range value (Slider, Meter, Progress) and the list collection read `process.env.NODE_ENV` inline instead of through a helper function a minifier cannot resolve.
