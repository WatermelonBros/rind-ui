// Server-renders a fixture with hydration annotations, puts its HTML in the test document and
// hydrates it in place: Angular must reuse the server's nodes, change none of their attributes
// and report no mismatch.
import {
  APP_ID,
  type ApplicationRef,
  provideZonelessChangeDetection,
  reflectComponentType,
  type Type,
} from "@angular/core"
import { bootstrapApplication, provideClientHydration } from "@angular/platform-browser"
import { afterEach, expect, vi } from "vitest"
import { serverDocument } from "./parity"

let apps: ApplicationRef[] = []
afterEach(() => {
  for (const app of apps) app.destroy()
  apps = []
  document.body.innerHTML = ""
})

let count = 0

/** Attributes of every element below `root`, in document order. */
const snapshot = (root: Element) =>
  Array.from(root.querySelectorAll("*"), (el) =>
    el.getAttributeNames().map((name) => `${name}=${el.getAttribute(name)}`),
  )

/** Hydrates `fixture`'s server HTML; returns its host once the client is stable. */
export async function hydrate(fixture: Type<unknown>): Promise<HTMLElement> {
  const selector = reflectComponentType(fixture)?.selector
  if (!selector) throw new Error("hydrate: the fixture needs a selector")
  // The server and the client must share the app id: hydration reads the server's state by it.
  const id = { provide: APP_ID, useValue: `hydrate${count++}` }
  const html = await serverDocument(fixture, [id, provideClientHydration()])
  // The body as the server sent it, hydration annotations and transfer state included.
  document.body.innerHTML = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? ""
  const host = document.querySelector<HTMLElement>(selector)
  if (!host) throw new Error(`hydrate: no <${selector}> in the server HTML`)
  const nodes = Array.from(host.querySelectorAll("*"))
  const before = snapshot(host)
  const errors = vi.spyOn(console, "error")
  const warnings = vi.spyOn(console, "warn")
  try {
    const app = await bootstrapApplication(fixture, {
      providers: [provideZonelessChangeDetection(), id, provideClientHydration()],
    })
    apps.push(app)
    await app.whenStable()
    const reported = [...errors.mock.calls, ...warnings.mock.calls].map((c) => String(c[0]))
    expect(reported.filter((m) => /NG0\d{3}|hydrat/i.test(m))).toEqual([])
  } finally {
    errors.mockRestore()
    warnings.mockRestore()
  }
  // Every server node reused, in place, with the same attributes (no id or state changed).
  expect(Array.from(host.querySelectorAll("*"))).toEqual(nodes)
  expect(snapshot(host)).toEqual(before)
  return host
}
