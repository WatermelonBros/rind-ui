---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/vue": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/angular": patch
"@rind-ui/theme": patch
---

Four fixes reported from a consumer project:

- MessageThread keeps following when the browser moves the viewport itself (the scroll range shrinks under a following thread, e.g. a composer that empties after a send): that scroll is no longer read as the user's, so JumpToLatest does not appear at the bottom.
- FileUpload's `onFilesChange` details are typed with the reasons it reports (`"add" | "remove" | "clear" | "reset" | "api"`, exported as `FileUploadChangeDetails`), not with event types. `ChangeDetails` takes the reason union as an optional second type parameter.
- `@rind-ui/theme/tokens.css` imports `icons.css`, so a component stylesheet loaded on its own draws its icons instead of a solid square.
- Toaster reads its messages from `RindProvider` under the `toast` scope; the Toaster's own `messages` prop still wins.
