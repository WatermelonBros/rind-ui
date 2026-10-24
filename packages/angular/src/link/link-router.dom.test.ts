// rindLink beside Angular's routerLink: one navigation (the router link's), not two.
import { Component } from "@angular/core"
import { provideRouter, Router, RouterLink } from "@angular/router"
import { screen } from "@testing-library/dom"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { RindProvider } from "../provider"
import { Link } from "./link"

@Component({ template: `` })
class Page {}

const navigate = vi.fn()
@Component({
  imports: [Link, RindProvider, RouterLink],
  template: `<ng-container rindProvider [environment]="env">
    <a rindLink routerLink="/docs">Docs</a>
  </ng-container>`,
})
class Both {
  readonly env = { router: { navigate } }
}

describe("rindLink with routerLink", () => {
  it("navigates once, through Angular's router", async () => {
    const { ref } = await mount(Both, {}, [provideRouter([{ path: "docs", component: Page }])])
    const router = ref.injector.get(Router)
    const link = screen.getByRole("link", { name: "Docs" })
    // The router link's href (Angular prefixes the origin when the page has no <base href>);
    // the part writes none of its own.
    expect(link.getAttribute("href")).toMatch(/\/docs$/)
    link.click()
    await vi.waitFor(() => expect(router.url).toBe("/docs"))
    expect(navigate).not.toHaveBeenCalled()
  })
})
