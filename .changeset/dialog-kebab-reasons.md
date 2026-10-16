---
"@rind-ui/core": patch
"@rind-ui/react": patch
---

Dialog and Alert Dialog report close and open reasons in kebab case (`escape-key`, `outside-press`, `close-trigger`, `cancel`, `action`, `api` …), like Popover and Tooltip; `DialogCloseReason` and `data-close-reason` follow.
