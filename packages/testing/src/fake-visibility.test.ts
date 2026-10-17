// The fake visibility: no DOM read, change-only notifications (page-visibility "Test without a DOM").
import { describe, expect, it } from "vitest"
import { fakeVisibility } from "./fake-visibility"

describe("fakeVisibility", () => {
  it("hides and shows the page; subscribers hear changes only", () => {
    const v = fakeVisibility()
    const heard: boolean[] = []
    v.subscribe((h) => heard.push(h))
    v.set(true)
    v.set(true)
    v.set(false)
    expect(heard).toEqual([true, false])
    expect(v.hidden()).toBe(false)
  })

  it("starts hidden when asked", () => {
    expect(fakeVisibility(true).hidden()).toBe(true)
  })
})
