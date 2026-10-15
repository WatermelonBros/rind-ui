// The in-page module: bundled as `dist/inpage.iife.js` and injected into Playwright pages
// once, so the Playwright adapter collects snapshots, names and visibility with exactly
// the code the DOM adapter imports.
import { computeAccessibleDescription, computeAccessibleName } from "dom-accessibility-api"
import { collectDom, isVisible } from "./collect"
import { labelledControl } from "./labelled"

export interface InPage {
  readonly collectDom: typeof collectDom
  readonly isVisible: typeof isVisible
  readonly labelledControl: typeof labelledControl
  readonly accessibleName: (el: Element) => string
  readonly accessibleDescription: (el: Element) => string
}

Reflect.set(globalThis, "__rindTesting", {
  collectDom,
  isVisible,
  labelledControl,
  accessibleName: (el: Element) => computeAccessibleName(el).replace(/\s+/g, " ").trim(),
  accessibleDescription: (el: Element) =>
    computeAccessibleDescription(el).replace(/\s+/g, " ").trim(),
} satisfies InPage)
