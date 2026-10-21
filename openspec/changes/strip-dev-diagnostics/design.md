## Context

A production build of `import * as R from "@rind-ui/react"` (esbuild, minified,
`process.env.NODE_ENV` = `"production"`) keeps 8 `[rind-ui]` messages: accordion 1, tour 5,
qr-code 1, table 1, plus 3 `console.warn` and 5 `console.error` calls. Some sources look gated
(accordion's `openKeysOf` checks `NODE_ENV`), so the leak may come from a second copy of the
message or from a build step; the implementation finds the cause of each before fixing it.

## Decisions

1. **`dev/diagnostics.ts`** in core:
   - `declare const process` once.
   - `devWarn(scope, message)`, `devError(scope, message)`, `devWarnOnce(key, scope, message)`:
     each body starts with `if (process.env.NODE_ENV === "production") return`. Call sites write
     `if (process.env.NODE_ENV !== "production") devWarn(...)` when the message is built from
     values (template literals, `JSON.stringify`), so the argument expressions are dropped too.
     Why the guard at call sites as well: a minifier removes a call to an empty function only
     when it can prove the arguments pure; an explicit guard is always removed.
   - `reportFailure(scope, message, error)`: never stripped, for callback failures.
2. **Classification** of each existing `console.*` call: misuse → diagnostic; consumer callback
   threw/rejected → failure report. Tour's two effect messages are failure reports; `goto`
   unknown id and `validateSteps` are diagnostics.
3. **Size check**: build the whole library for production; collect `[rind-ui] <scope>:` strings;
   allow only messages produced by `reportFailure` (its scope/message pairs are listed in the
   script's allow list, reviewed in the PR).
4. **Lint**: `scripts/lint-platform.mjs` already scans source for forbidden patterns; add
   `console.(warn|error|log)` outside `dev/diagnostics.ts` and tests.

## Risks / Trade-offs

- [Guard at call site is repetitive] → it is the one form every minifier removes; the helper
  keeps the message format and once-per-key logic in one place.
