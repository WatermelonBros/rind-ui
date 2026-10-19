// stick-to-bottom in a real browser: its own scrolls are not the user's, an upward wheel
// escapes, growth is followed only while following, a prepend keeps the position.
import { afterEach, describe, expect, it } from "vitest"
import { atBottom, stickToBottom } from "./stick-to-bottom"

const browser = !navigator.userAgent.includes("jsdom")
afterEach(() => {
  document.body.innerHTML = ""
})

const frames = (n = 2) =>
  new Promise<void>((r) => {
    const step = (k: number) => (k <= 0 ? r() : requestAnimationFrame(() => step(k - 1)))
    step(n)
  })

function setup(following = true) {
  document.body.innerHTML = `<div id="v" style="height:200px;overflow-y:auto;overflow-anchor:none"><div id="c"></div></div>`
  const v = document.getElementById("v") as HTMLElement
  const c = document.getElementById("c") as HTMLElement
  const add = (n: number, where: "end" | "start" = "end") => {
    for (let i = 0; i < n; i++) {
      const p = document.createElement("p")
      p.style.cssText = "height:50px;margin:0"
      p.textContent = `line ${i}`
      if (where === "end") c.append(p)
      else c.prepend(p)
    }
  }
  const facts: { atBottom: boolean; up: boolean }[] = []
  let escapes = 0
  let follow = following
  const s = stickToBottom(v, c, {
    threshold: 32,
    onUserScroll: (f) => facts.push(f),
    onEscape: () => {
      escapes++
    },
    following: () => follow,
  })
  return {
    v,
    add,
    facts,
    s,
    escapes: () => escapes,
    setFollow: (f: boolean) => {
      follow = f
    },
  }
}

describe.runIf(browser)("stick-to-bottom", () => {
  it("atBottom has a tolerance", () => {
    const { v, add } = setup()
    add(10)
    v.scrollTop = v.scrollHeight - v.clientHeight - 20
    expect(atBottom(v, 32)).toBe(true)
    expect(atBottom(v, 10)).toBe(false)
  })

  it("its own scroll to the bottom is not reported as the user's", async () => {
    const { add, s, facts } = setup(false)
    add(10)
    s.scrollToBottom("instant")
    await frames()
    expect(facts).toEqual([])
  })

  it("a user scroll up is reported, an upward wheel escapes", async () => {
    const { v, add, s, facts, escapes } = setup(false)
    add(10)
    s.scrollToBottom("instant")
    await frames()
    v.scrollTop -= 100
    await frames()
    expect(facts.at(-1)).toEqual({ atBottom: false, up: true })
    v.dispatchEvent(new WheelEvent("wheel", { deltaY: -40 }))
    expect(escapes()).toBe(1)
  })

  it("growth is followed only while following", async () => {
    const t = setup(true)
    t.add(10)
    await frames(3)
    expect(atBottom(t.v, 1)).toBe(true)
    t.setFollow(false)
    t.add(5)
    await frames(3)
    expect(atBottom(t.v, 1)).toBe(false)
  })

  it("a prepend keeps the reading position", async () => {
    const { v, add, s } = setup(false)
    add(10)
    v.scrollTop = 100
    const first = v.querySelector("p:nth-child(3)") as HTMLElement
    const before = first.getBoundingClientRect().top
    const snap = s.snapshot()
    add(10, "start")
    s.restore(snap)
    expect(Math.abs(first.getBoundingClientRect().top - before)).toBeLessThan(1)
  })
})
