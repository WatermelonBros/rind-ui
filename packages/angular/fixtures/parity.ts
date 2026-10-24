// The same scenario rendered by @rind-ui/react and @rind-ui/angular must produce the same markup
// (canonical form: see canonicalHtml), on the server and after mount. Angular's own attributes
// (directive selectors, hydration and version markers) are not markup and are removed first.
import {
  APP_ID,
  type ApplicationRef,
  type EnvironmentProviders,
  type Provider,
  provideZonelessChangeDetection,
  reflectComponentType,
  type Type,
} from "@angular/core"
import { type BootstrapContext, bootstrapApplication } from "@angular/platform-browser"
import { provideServerRendering, renderApplication } from "@angular/platform-server"
import { canonicalHtml } from "@rind-ui/testing"
import type { ReactElement } from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString as reactToString } from "react-dom/server"
import { expect, vi } from "vitest"
import { mount } from "./mount"

/** React reads it to know `act` wraps the updates. */
const reactAct = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

/** Angular's own attributes: `rind…` directive selectors, version, hydration, dev reflection. */
const ANGULAR = /^(rind|ng-version$|ng-server-context$|ngh$|ng-reflect-|_ngcontent-|_nghost-)/

/**
 * `node` without Angular's own attributes, removed in place: a copy would re-parse the styles,
 * and jsdom drops a value it serialised itself (`clip: rect(0px)`).
 */
export function withoutAngular<N extends ParentNode>(node: N): N {
  for (const el of Array.from(node.querySelectorAll("*"))) {
    for (const name of el.getAttributeNames()) if (ANGULAR.test(name)) el.removeAttribute(name)
  }
  return node
}

/**
 * Runs a server render and gives the test environment its DOM back: the server platform installs
 * its own DOM classes (`Element`, `Node`, `Event`…) as globals, and the test's elements would no
 * longer be `instanceof Element`.
 */
async function serverOnly<T>(render: () => Promise<T>): Promise<T> {
  const scope = globalThis as Record<string, unknown>
  const before = new Map(Object.getOwnPropertyNames(scope).map((k) => [k, scope[k]]))
  try {
    return await render()
  } finally {
    for (const key of Object.getOwnPropertyNames(scope)) {
      if (!before.has(key)) delete scope[key]
      else if (!Object.is(scope[key], before.get(key))) scope[key] = before.get(key)
    }
  }
}

let apps = 0
/** Ids canonicalHtml recognises as generated (`parity<n>-<count>`). */
const appId = () => ({ provide: APP_ID, useValue: `parity${apps++}` })

const selectorOf = (fixture: Type<unknown>) => {
  const selector = reflectComponentType(fixture)?.selector
  if (!selector) throw new Error("the fixture needs a selector")
  return selector
}

/** The whole server document for `fixture`, rendered with `providers` (hydration, an app id). */
export function serverDocument(
  fixture: Type<unknown>,
  providers: (Provider | EnvironmentProviders)[] = [appId()],
): Promise<string> {
  const selector = selectorOf(fixture)
  return serverOnly(() =>
    renderApplication(
      (context: BootstrapContext): Promise<ApplicationRef> =>
        bootstrapApplication(
          fixture,
          { providers: [provideZonelessChangeDetection(), provideServerRendering(), ...providers] },
          context,
        ),
      { document: `<html><body><${selector}></${selector}></body></html>`, url: "/" },
    ),
  )
}

/** The server HTML inside `fixture`'s host, without Angular's own attributes. */
export async function serverHtml(fixture: Type<unknown>): Promise<string> {
  const selector = selectorOf(fixture)
  const html = await serverDocument(fixture)
  const inner = new RegExp(`<${selector}[^>]*>([\\s\\S]*)</${selector}>`).exec(html)?.[1]
  if (inner === undefined) throw new Error(`serverHtml: no <${selector}> in the server HTML`)
  // The test document parses it: the server platform's DOM classes are not the test's.
  const host = Object.assign(document.createElement("template"), { innerHTML: inner }).content
  withoutAngular(host)
  const out = document.createElement("div")
  out.append(host)
  return out.innerHTML
}

/** Server HTML of both, canonical. `fixture` is a standalone component with a selector. */
export async function serverParity(react: ReactElement, fixture: Type<unknown>) {
  const expected = canonicalHtml(reactToString(react))
  const host = document.createElement("div")
  host.innerHTML = await serverHtml(fixture)
  expect(canonicalHtml(host)).toBe(expected)
}

/** A frame of the page's (measured parts write on one). */
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()))

/** React's DOM, canonical, once two frames pass without a change (measured parts settled). */
export async function reactSettled(react: ReactElement): Promise<string> {
  reactAct.IS_REACT_ACT_ENVIRONMENT = true
  const r = document.body.appendChild(document.createElement("div"))
  // Where the pointer rests (a previous test's last move) is not markup: hover stays out.
  r.style.pointerEvents = "none"
  const root = createRoot(r)
  try {
    await act(async () => root.render(react))
    let last = canonicalHtml(r)
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await frame()
        await frame()
      })
      const next = canonicalHtml(r)
      if (next === last) break
      last = next
    }
    return last
  } finally {
    await act(async () => root.unmount())
    r.remove()
  }
}

/**
 * The DOM of both after mount (effects run), canonical. One after the other: two instances in
 * one document would see each other (the same ids, a modal's inert outside, focus).
 */
export async function clientParity(react: ReactElement, fixture: Type<unknown>) {
  const expected = await reactSettled(react)
  const { host } = await mount(fixture, {}, [appId()])
  host.style.pointerEvents = "none"
  // Measured parts (Scroll Area) settle on a later frame.
  await vi.waitFor(() => expect(canonicalHtml(withoutAngular(host))).toBe(expected))
}

/** Client markup everywhere; server markup too where the server platform runs (Node: jsdom). */
export async function both(react: ReactElement, fixture: Type<unknown>) {
  const node = (globalThis as { process?: { versions?: { node?: string } } }).process?.versions
    ?.node
  if (node !== undefined) await serverParity(react, fixture)
  await clientParity(react, fixture)
}
