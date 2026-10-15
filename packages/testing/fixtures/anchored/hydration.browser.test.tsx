// Spec "Open after hydration": a server-rendered page hydrates and the first open is placed
// against the trigger, not at the viewport origin.
import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { expect, it } from "vitest"
import { AnchoredExample } from "./anchored.react"

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
    step(n)
  })

it("Open after hydration", async () => {
  // React's act() outside Testing Library: tell React this is a test environment.
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
  const ui = (
    <div style={{ padding: "160px 200px" }}>
      <AnchoredExample label="Menu" />
    </div>
  )
  const container = document.createElement("div")
  container.innerHTML = renderToString(ui)
  document.body.append(container)
  const errors: unknown[] = []
  const original = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const root = await act(async () => hydrateRoot(container, ui))
    expect(errors).toEqual([])
    const trigger = container.querySelector("button") as HTMLButtonElement
    await act(async () => trigger.click())
    await frames(3)
    const positioner = document.querySelector('[data-part="positioner"]') as HTMLElement
    expect(positioner.hasAttribute("data-placing")).toBe(false)
    const p = positioner.getBoundingClientRect()
    const t = trigger.getBoundingClientRect()
    // Below the trigger (side bottom), not at the viewport origin.
    expect(p.top).toBeGreaterThanOrEqual(t.bottom - 0.5)
    expect(p.top).toBeLessThan(t.bottom + 2)
    act(() => root.unmount())
  } finally {
    console.error = original
    container.remove()
  }
})
