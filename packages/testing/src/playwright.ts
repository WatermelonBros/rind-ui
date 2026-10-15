// `@rind-ui/testing/playwright`: the Playwright adapter alone. No runtime Playwright import.

export {
  type AxNode,
  axNodeOf,
  type ChromiumTreeOptions,
  chromiumTree,
  type Unavailable,
} from "./adapters/chromium-tree"
export {
  type PlaywrightAdapterOptions,
  type PlaywrightTarget,
  playwrightEnv,
} from "./adapters/playwright"
