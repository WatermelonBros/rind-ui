## Context

After #192 a production build of `import * as R from "@rind-ui/react"` (esbuild, minified,
`process.env.NODE_ENV` = `"production"`) keeps eight `[rind-ui]` strings:

| message | kind |
|---|---|
| accordion: an item value must be a non-empty string | thrown error |
| tour: two steps share the id | thrown error |
| qr-code: there is no symbol to export | thrown error |
| tour: the effect of step … threw / rejected (×2) | callback failure report |
| tour: the cleanup of step … threw | callback failure report |
| tour: goto(…): no step has this id | **development diagnostic** |
| table: ${message} (`warnOnce`) | **development diagnostic** |

## Decisions

1. **Guards inline**, as #192: `if (process.env.NODE_ENV !== "production") console.error(…)` in
   Tour's `knownStep`; `warnOnce` in Table starts with
   `if (process.env.NODE_ENV === "production") return`, so the minifier drops its body even
   though esbuild keeps the function (its guarded caller is removed after tree shaking).
2. **Size check.** Bundle the whole library for production, collect each `[rind-ui] <scope>:`
   console call site, and fail on any not in an allow-list of failure reports. Thrown errors are
   told apart by the source: the check matches the message strings inside `console.` calls only
   (`console.(warn|error)(` followed by a template or string starting with `[rind-ui]`).
   The allow-list holds the three Tour failure reports; a new entry needs a reason in the PR.
