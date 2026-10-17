// add-tour 1.3: the visit's cleanup slot runs exactly once, whenever it arrives.
import { describe, expect, it, vi } from "vitest"
import { createStepVisit } from "./step-effect"

describe("createStepVisit", () => {
  it("release aborts the signal and runs the cleanup once", () => {
    const v = createStepVisit("a")
    const cleanup = vi.fn()
    v.setResult(cleanup)
    v.release()
    v.release()
    expect(v.signal.aborted).toBe(true)
    expect(v.released).toBe(true)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("a cleanup returned after release runs at once", () => {
    const v = createStepVisit("a")
    v.release()
    const cleanup = vi.fn()
    v.setResult(cleanup)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("a promise of a cleanup that settles after release runs it then", async () => {
    const v = createStepVisit("a")
    const cleanup = vi.fn()
    let settle: (fn: () => void) => void = () => {}
    v.setResult(new Promise<() => void>((r) => (settle = r)))
    v.release()
    expect(cleanup).not.toHaveBeenCalled()
    settle(cleanup)
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1))
  })

  it("a promise of a cleanup that settles before release runs it on release", async () => {
    const v = createStepVisit("a")
    const cleanup = vi.fn()
    const p = Promise.resolve(cleanup)
    v.setResult(p)
    await p
    await vi.waitFor(() => {
      v.release()
      expect(cleanup).toHaveBeenCalledTimes(1)
    })
  })

  it("a throwing cleanup is logged, not thrown", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const v = createStepVisit("a")
    v.setResult(() => {
      throw new Error("boom")
    })
    expect(() => v.release()).not.toThrow()
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })

  it("no result and a rejected promise are fine", async () => {
    const v = createStepVisit("a")
    v.setResult(undefined)
    v.setResult(Promise.reject(new Error("x")))
    v.release()
    expect(v.released).toBe(true)
  })
})
