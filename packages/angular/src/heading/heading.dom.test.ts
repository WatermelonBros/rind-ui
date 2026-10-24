// Heading, Label and Link: the same markup as @rind-ui/react; Link routes through the provider.
import { Component } from "@angular/core"
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Label } from "../label/label"
import { Link } from "../link/link"
import { RindProvider } from "../provider"
import { Heading, HeadingLevelSection } from "./heading"

const H = [Heading, HeadingLevelSection] as const

@Component({ selector: "rind-f", imports: [Heading], template: `<h2 rindHeading>Settings</h2>` })
class Top {}
@Component({
  selector: "rind-f",
  imports: [H],
  template: `<ng-container rindHeadingLevel>
    <h3 rindHeading>A</h3>
    <ng-container rindHeadingLevel><h4 rindHeading>B</h4></ng-container>
  </ng-container>`,
})
class Nested {}
@Component({ selector: "rind-f", imports: [Heading], template: `<h5 [rindHeading]="5">E</h5>` })
class Explicit {}
@Component({ selector: "rind-f", imports: [Heading], template: `<h4 rindHeading>H</h4>` })
class OtherTag {}
@Component({
  imports: [H],
  template: `<ng-container rindHeadingLevel><h2 rindHeading #h="rindHeading">Card</h2></ng-container>
    <div rindHeading>Div</div>`,
})
class Reused {}

describe("Angular Heading matches React", () => {
  it("levels from nesting, explicit level, another heading element", async () => {
    await both(r(R.Heading, null, "Settings"), Top)
    await both(
      r(
        R.Heading.Level,
        null,
        r(R.Heading, null, "A"),
        r(R.Heading.Level, null, r(R.Heading, null, "B")),
      ),
      Nested,
    )
    await both(r(R.Heading, { level: 5 }, "E"), Explicit)
    await both(r(R.Heading, { render: r("h4") }, "H"), OtherTag)
  })

  it("a heading element that does not match its level keeps the level for assistive technology", async () => {
    await mount(Reused)
    expect(screen.getByRole("heading", { name: "Card", level: 3 }).tagName).toBe("H2")
    expect(screen.getByRole("heading", { name: "Div", level: 2 }).tagName).toBe("DIV")
  })
})

@Component({
  selector: "rind-f",
  imports: [Label],
  template: `<div><label rindLabel for="n">Name</label><input id="n" /></div>`,
})
class For {}
@Component({
  selector: "rind-f",
  imports: [Label],
  template: `<label rindLabel>Name <input /></label>`,
})
class Wrapping {}

describe("Angular Label matches React", () => {
  it("for, wrapping", async () => {
    await both(r("div", null, r(R.Label, { htmlFor: "n" }, "Name"), r("input", { id: "n" })), For)
    await both(r(R.Label, null, "Name ", r("input")), Wrapping)
  })
})

@Component({ selector: "rind-f", imports: [Link], template: `<a rindLink href="/a">A</a>` })
class Internal {}
@Component({
  selector: "rind-f",
  imports: [Link],
  template: `<a rindLink href="mailto:a@b.c">M</a>`,
})
class Mail {}
@Component({
  selector: "rind-f",
  imports: [Link],
  template: `<a rindLink href="https://x.test/" target="_blank">X</a>`,
})
class External {}
@Component({
  selector: "rind-f",
  imports: [Link],
  template: `<a rindLink href="/a" [disabled]="true">D</a>`,
})
class Disabled {}
@Component({
  selector: "rind-f",
  imports: [Link],
  template: `<a rindLink href="/a" current="page">C</a>`,
})
class Current {}

const navigate = vi.fn()
const onClick = vi.fn()
@Component({
  imports: [Link, RindProvider],
  template: `<ng-container rindProvider [environment]="env">
    <a rindLink href="/docs">Docs</a>
    <a rindLink href="/off" [disabled]="true" (click)="clicked()">Off</a>
  </ng-container>`,
})
class Routed {
  readonly env = { router: { navigate } }
  clicked() {
    onClick()
  }
}

describe("Angular Link", () => {
  it("matches React: href, external, disabled, current", async () => {
    await both(r(R.Link, { href: "/a" }, "A"), Internal)
    await both(r(R.Link, { href: "mailto:a@b.c" }, "M"), Mail)
    await both(r(R.Link, { href: "https://x.test/", target: "_blank" }, "X"), External)
    await both(r(R.Link, { href: "/a", disabled: true }, "D"), Disabled)
    await both(r(R.Link, { href: "/a", current: "page" }, "C"), Current)
  })

  it("routes through the provider's router; a disabled link drops the consumer's click", async () => {
    await mount(Routed)
    screen.getByRole("link", { name: "Docs" }).click()
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate.mock.calls[0]?.[0]).toBe("/docs")
    screen.getByText("Off").click()
    expect(onClick).not.toHaveBeenCalled()
  })
})
