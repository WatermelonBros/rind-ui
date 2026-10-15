// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { accessibleNameOf } from "./accname"

const el = (html: string) => {
  document.body.innerHTML = html
  return document.getElementById("t") as HTMLElement
}

describe("accessibleNameOf", () => {
  it("prefers aria-labelledby, joined in order", () => {
    expect(
      accessibleNameOf(
        el(
          '<span id="a">One</span><span id="b">Two</span><button id="t" aria-labelledby="a b">x</button>',
        ),
      ),
    ).toBe("One Two")
  })
  it("uses aria-label on descendants, skips aria-hidden ones, collapses whitespace", () => {
    expect(
      accessibleNameOf(
        el('<button id="t"> Mute <svg aria-hidden="true">no</svg> <img alt="icon"></button>'),
      ),
    ).toBe("Mute icon")
  })
  it("text of the element itself", () => {
    expect(accessibleNameOf(el('<button id="t">Bold</button>'))).toBe("Bold")
  })
})
