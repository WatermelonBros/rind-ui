// Element info is read from the rendered element (button-like-element "Element Substitution").
import { describe, expect, it } from "vitest"
import { elementInfo } from "./element-info"

const make = (html: string) => {
  const t = document.createElement("template")
  t.innerHTML = html
  return t.content.firstElementChild as Element
}

describe("elementInfo", () => {
  const cases: [string, string, { tag: string; link: boolean; labelable: boolean }][] = [
    ["<button></button>", "button", { tag: "button", link: false, labelable: true }],
    ["<input>", "input", { tag: "input", link: false, labelable: true }],
    ["<a href='/x'></a>", "a[href]", { tag: "a", link: true, labelable: false }],
    ["<a></a>", "a without href", { tag: "a", link: false, labelable: false }],
    ["<area href='/x'>", "area[href]", { tag: "area", link: true, labelable: false }],
    ["<area>", "area without href", { tag: "area", link: false, labelable: false }],
    ["<div></div>", "div", { tag: "div", link: false, labelable: false }],
    ["<select></select>", "select", { tag: "select", link: false, labelable: true }],
    ["<span></span>", "span", { tag: "span", link: false, labelable: false }],
  ]
  it.each(cases)("%s (%s)", (html, _n, expected) => {
    expect(elementInfo(make(html))).toMatchObject(expected)
  })

  it("reads the explicit role, null when absent", () => {
    expect(elementInfo(make("<div role='switch'></div>")).role).toBe("switch")
    expect(elementInfo(make("<div></div>")).role).toBeNull()
  })

  it("lowercases the tag of any element", () => {
    expect(elementInfo(document.createElementNS("http://www.w3.org/2000/svg", "svg")).tag).toBe(
      "svg",
    )
  })
})
