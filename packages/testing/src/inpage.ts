// The in-page module: bundled as `dist/inpage.iife.js` and injected into Playwright pages
// once, so the Playwright adapter collects snapshots, names and visibility with exactly
// the code the DOM adapter imports.
import { collectDom, isVisible } from "./collect"

export interface InPage {
  readonly collectDom: typeof collectDom
  readonly isVisible: typeof isVisible
}

Reflect.set(globalThis, "__rindTesting", { collectDom, isVisible } satisfies InPage)
